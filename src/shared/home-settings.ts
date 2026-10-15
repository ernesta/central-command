/**
 * What the Home page, notifications and the Mac widget may do. Everything that reaches outside the app (the
 * weather) or interrupts the user (notifications) is OFF until they turn it on in Settings.
 */
export interface WeatherSettings {
  /** Off by default: asking for the weather sends a place's coordinates to a weather service. */
  enabled: boolean
  /** What the user typed, shown back to them ("Egham"). */
  place: string
  /** Rounded to one decimal (about 10 km) before it is ever sent: a town, not a street. */
  latitude: number | null
  longitude: number | null
  unit: 'celsius' | 'fahrenheit'
}

export interface NotificationSettings {
  enabled: boolean
  /** One summary of the day ("3 tasks due, supervision at 14:00"), at this local time (HH:MM). Empty = none. */
  digestAt: string
  /** A reminder this many minutes before a meeting that has a start time. 0 = none. */
  meetingMinutesBefore: number
  /** The timer has run this many hours without a stop. 0 = none. */
  timerRunningHours: number
  /** New things found by Watch that mention one of the user's keywords. */
  watchRelevant: boolean
  /** A deadline Watch found, this many days before. 0 = none. */
  watchDeadlineDays: number
}

export interface WidgetSettings {
  /** Write the small file a Mac widget reads (today's tasks, the timer, the next meeting). Nothing leaves the Mac. */
  enabled: boolean
}

export interface HomeSettings {
  weather: WeatherSettings
  notifications: NotificationSettings
  widget: WidgetSettings
}

export interface HomePatch {
  weather?: Partial<WeatherSettings>
  notifications?: Partial<NotificationSettings>
  widget?: Partial<WidgetSettings>
}

export const DEFAULT_HOME_SETTINGS: HomeSettings = {
  weather: { enabled: false, place: '', latitude: null, longitude: null, unit: 'celsius' },
  notifications: {
    enabled: false,
    digestAt: '08:30',
    meetingMinutesBefore: 10,
    timerRunningHours: 0,
    watchRelevant: true,
    watchDeadlineDays: 7
  },
  widget: { enabled: false }
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const int = (v: unknown, min: number, max: number, d: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : d
const coord = (v: unknown, limit: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit
    ? Math.round(v * 10) / 10
    : null

/** Untrusted JSON merged over the defaults, keeping only well-typed values (a hand-edited file cannot break the app). */
export function normaliseHome(
  raw: unknown,
  defaults: HomeSettings = DEFAULT_HOME_SETTINGS
): HomeSettings {
  const o = obj(raw)
  const w = obj(o.weather)
  const n = obj(o.notifications)
  const g = obj(o.widget)
  const lat = coord(w.latitude, 90)
  const lon = coord(w.longitude, 180)
  const place = typeof w.place === 'string' ? w.place.trim().slice(0, 80) : defaults.weather.place
  const located = lat !== null && lon !== null
  return {
    weather: {
      // Weather needs a place: without coordinates it stays off, whatever the file says.
      enabled: bool(w.enabled, defaults.weather.enabled) && located,
      place,
      latitude: located ? lat : null,
      longitude: located ? lon : null,
      unit:
        w.unit === 'fahrenheit'
          ? 'fahrenheit'
          : w.unit === 'celsius'
            ? 'celsius'
            : defaults.weather.unit
    },
    notifications: {
      enabled: bool(n.enabled, defaults.notifications.enabled),
      digestAt:
        n.digestAt === ''
          ? ''
          : typeof n.digestAt === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(n.digestAt)
            ? n.digestAt
            : defaults.notifications.digestAt,
      meetingMinutesBefore: int(
        n.meetingMinutesBefore,
        0,
        240,
        defaults.notifications.meetingMinutesBefore
      ),
      timerRunningHours: int(n.timerRunningHours, 0, 24, defaults.notifications.timerRunningHours),
      watchRelevant: bool(n.watchRelevant, defaults.notifications.watchRelevant),
      watchDeadlineDays: int(n.watchDeadlineDays, 0, 90, defaults.notifications.watchDeadlineDays)
    },
    widget: { enabled: bool(g.enabled, defaults.widget.enabled) }
  }
}

/** A patch applied to the current settings, one level deep (a patch of one notification flag keeps the rest). */
export function applyHomePatch(current: HomeSettings, patch: HomePatch | undefined): HomeSettings {
  if (!patch) return current
  return normaliseHome(
    {
      weather: { ...current.weather, ...patch.weather },
      notifications: { ...current.notifications, ...patch.notifications },
      widget: { ...current.widget, ...patch.widget }
    },
    current
  )
}
