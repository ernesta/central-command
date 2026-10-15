import type { NotificationSettings } from '@shared/home-settings'
import { planNotifications, pruneSent, type PlannedNotification } from '../shared/notifications'
import type { HomeSummary } from '../shared/types'

/** Where "already sent" is kept between runs of the app (a small JSON file, so a restart does not repeat the morning digest). */
export interface SentStore {
  load(): { sent: Record<string, string>; since: string | null }
  save(value: { sent: Record<string, string>; since: string }): void
}

export interface NotifierDeps {
  summary: () => HomeSummary
  settings: () => NotificationSettings
  store: SentStore
  /** Shows one notification; `onClick` runs when the user clicks it. */
  show: (n: PlannedNotification) => void
  /** Local date and time now. */
  now: () => { date: string; time: string }
  nowIso: () => string
}

/**
 * Looks at the day once a minute and tells the user what is new. Everything it has told is remembered, so a notification
 * is shown once. The first time it runs with notifications on, nothing that already existed is announced.
 */
export class Notifier {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly deps: NotifierDeps) {}

  /** One pass; returns what was shown. Safe to call as often as wanted. */
  tick(): PlannedNotification[] {
    const settings = this.deps.settings()
    if (!settings.enabled) return []
    const now = this.deps.now()
    const stored = this.deps.store.load()
    const since = stored.since ?? this.deps.nowIso()
    const planned = planNotifications(
      this.deps.summary(),
      settings,
      { sent: new Set(Object.keys(stored.sent)), since },
      now
    )
    const sent = pruneSent(stored.sent, now.date)
    for (const n of planned) {
      this.deps.show(n)
      for (const key of [n.key, ...(n.covers ?? [])]) sent[key] = now.date
    }
    if (planned.length > 0 || stored.since === null) this.deps.store.save({ sent, since })
    return planned
  }

  start(everyMs = 60_000): void {
    this.stop()
    this.timer = setInterval(() => {
      try {
        this.tick()
      } catch {
        // A failed look at the day is tried again a minute later; it must never take the app down.
      }
    }, everyMs)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
