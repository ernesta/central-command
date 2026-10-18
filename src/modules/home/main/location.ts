export type LocationFailure = 'denied' | 'unavailable'

export type LocationResult =
  | { ok: true; latitude: number; longitude: number; place: string }
  | { ok: false; reason: LocationFailure }

const round = (v: number): number => Math.round(v * 10) / 10

/**
 * What the native helper (`native/locate.swift`) printed, as a town: the position is rounded to one decimal (about 10 km)
 * here, before anything else sees it, so the precise position never leaves this function.
 */
export function parseLocation(stdout: string): LocationResult {
  try {
    const raw = JSON.parse(stdout.trim()) as Record<string, unknown>
    const { latitude, longitude } = raw
    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    )
      return {
        ok: true,
        latitude: round(latitude),
        longitude: round(longitude),
        place: typeof raw.place === 'string' ? raw.place.trim().slice(0, 80) : ''
      }
    return { ok: false, reason: raw.error === 'denied' ? 'denied' : 'unavailable' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

/** A position is reused this long (a town does not move in half an hour), a failure a shorter while. */
export const LOCATION_CACHE_MS = 30 * 60_000
export const LOCATION_FAILURE_MS = 2 * 60_000

/** Runs the helper and gives what it printed; rejects when it cannot be run. */
export type LocateRunner = () => Promise<string>

/** This Mac's position, asked of Location Services through the helper at most every half hour. */
export class LocationService {
  private cache: { at: number; result: LocationResult } | null = null
  private pending: Promise<LocationResult> | null = null

  constructor(
    private readonly run: LocateRunner | null,
    private readonly clock: () => number = Date.now
  ) {}

  async current(): Promise<LocationResult> {
    const cached = this.cache
    if (cached) {
      const age = this.clock() - cached.at
      if (age < (cached.result.ok ? LOCATION_CACHE_MS : LOCATION_FAILURE_MS)) return cached.result
    }
    this.pending ??= this.ask().finally(() => {
      this.pending = null
    })
    return this.pending
  }

  /** Forget what was read (the user turned Weather off and on again, perhaps after allowing the location). */
  forget(): void {
    this.cache = null
  }

  private async ask(): Promise<LocationResult> {
    let result: LocationResult
    if (!this.run) result = { ok: false, reason: 'unavailable' }
    else {
      try {
        result = parseLocation(await this.run())
      } catch {
        result = { ok: false, reason: 'unavailable' }
      }
    }
    // A failed read keeps the last good position rather than blanking the page, unless the permission was taken away.
    if (!result.ok && result.reason !== 'denied' && this.cache?.result.ok) {
      this.cache = { at: this.clock(), result: this.cache.result }
      return this.cache.result
    }
    this.cache = { at: this.clock(), result }
    return result
  }
}
