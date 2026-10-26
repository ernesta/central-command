/**
 * What the Home page, notifications and the Mac widget may do. Everything that reaches outside the app (the
 * weather) or interrupts the user (notifications) is OFF until they turn it on in Settings.
 */
export interface WeatherSettings {
  /**
   * Off by default: asking for the weather reads this Mac's position (Location Services) and sends its rounded value, a
   * town, to a weather service. The place and the unit are not settings: they come from the Mac.
   */
  enabled: boolean
}

export interface NotificationSettings {
  enabled: boolean
  /** One summary of the day ("3 tasks due, supervision at 14:00"), at this local time (HH:MM). Empty = none. */
  digestAt: string
  /** A reminder this many minutes before a meeting that has a start time. 0 = none. */
  meetingMinutesBefore: number
  /** The timer has run this many hours without a stop. 0 = none. */
  timerRunningHours: number
  /**
   * Tell me when Watch finds new items. Off by default. Like the next setting it is the user's own switch for Watch alone
   * (set in Settings → Watch), so it works without the master `enabled` that turns on the digest and meeting reminders.
   */
  watchNew: boolean
  /** The deadline of an item the user SAVED in Watch, this many days before. 0 = off (the default). */
  watchSavedDays: number
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
  weather: { enabled: false },
  notifications: {
    enabled: false,
    digestAt: '08:30',
    meetingMinutesBefore: 10,
    timerRunningHours: 0,
    watchNew: false,
    watchSavedDays: 0
  },
  widget: { enabled: false }
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const int = (v: unknown, min: number, max: number, d: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : d
/** Untrusted JSON merged over the defaults, keeping only well-typed values (a hand-edited file cannot break the app). */
export function normaliseHome(
  raw: unknown,
  defaults: HomeSettings = DEFAULT_HOME_SETTINGS
): HomeSettings {
  const o = obj(raw)
  const w = obj(o.weather)
  const n = obj(o.notifications)
  const g = obj(o.widget)
  return {
    weather: { enabled: bool(w.enabled, defaults.weather.enabled) },
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
      watchNew: bool(n.watchNew, defaults.notifications.watchNew),
      watchSavedDays: int(n.watchSavedDays, 0, 90, defaults.notifications.watchSavedDays)
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
