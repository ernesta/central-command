import type { WatchCounts, WatchItem } from '../../watch/shared/types'
import type { WatchKind } from '../../watch/shared/types'

export type HomeWorkspace = 'research' | 'work'

export interface HomeTask {
  uid: string
  title: string
  workspace: HomeWorkspace
  list: string
  due: string
  priority: 'high' | 'normal' | 'low'
  status: 'todo' | 'doing'
  /** Days past its due date (0 = due today). */
  daysLate: number
  route: string
}

export interface HomeMeeting {
  workspace: HomeWorkspace
  id: string
  series: string
  date: string
  start: string | null
  end: string | null
  route: string
}

export type HomeEventKind = 'task' | 'meeting' | 'training' | 'time-off' | 'deadline' | 'event'

/** One line of "coming up": anything with a date, from any source, in one list. */
export interface HomeEvent {
  id: string
  kind: HomeEventKind
  date: string
  /** HH:MM, or null for an all-day item. */
  time: string | null
  title: string
  /** A few words: the list, the series, the source. */
  detail: string
  /** Where clicking it goes (an in-app route, or an https address for a Watch item). */
  route: string
  /** Days from today (0 = today). */
  inDays: number
  /** Set on a task: what its status circle and priority mark show. */
  task?: { uid: string; status: 'todo' | 'doing'; priority: 'high' | 'normal' | 'low' }
}

export interface HomeTimer {
  workspace: HomeWorkspace
  label: string
  /** YYYY-MM-DD and HH:MM it started. */
  date: string
  time: string
  /** Whole minutes so far. */
  minutes: number
}

export interface HomeHours {
  todayMinutes: number
  weekMinutes: number
  /** The week's aim, minutes (0 = no aim). */
  weekAimMinutes: number
}

export interface WeatherSummary {
  place: string
  unit: 'celsius' | 'fahrenheit'
  /** When the numbers were read. */
  at: string
  now: {
    temperature: number
    feelsLike: number
    code: number
    description: string
    windKph: number
  }
  /** Today and the next two days. */
  days: {
    date: string
    code: number
    description: string
    high: number
    low: number
    rainChance: number
  }[]
}

export interface WatchBrief {
  counts: WatchCounts
  /** The best new items that mention a keyword (a handful). */
  relevant: WatchItem[]
}

export interface HomeSummary {
  today: string
  generatedAt: string
  timer: HomeTimer | null
  hours: HomeHours | null
  tasks: {
    overdue: HomeTask[]
    today: HomeTask[]
    overdueTotal: number
    todayTotal: number
  }
  meetings: {
    next: HomeMeeting | null
    openTodos: number
  }
  upcoming: HomeEvent[]
  watch: WatchBrief | null
  /** Null when weather is off, has no place yet, or could not be read. */
  weather: WeatherSummary | null
}

export type { WatchKind }

export interface HomeApi {
  /** Everything the Home page shows, read now. */
  summary(): Promise<HomeSummary>
  /** The weather, read again (it is also part of `summary`); null when it is off. */
  weather(): Promise<WeatherSummary | null>
  /** Looks up a place by name (the name is the only thing sent) and returns candidates to choose from. */
  findPlace(name: string): Promise<PlaceCandidate[]>
}

export interface PlaceCandidate {
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
}

export const HOME_IPC = {
  summary: 'home:summary',
  weather: 'home:weather',
  findPlace: 'home:find-place'
} as const
