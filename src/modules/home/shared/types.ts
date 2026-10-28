import type { WatchCounts, WatchItem, WatchWorkspace } from '../../watch/shared/types'
import type { WatchKind } from '../../watch/shared/types'

import type { TaskStatus } from '../../tasks/shared/types'

export type HomeWorkspace = 'research' | 'work' | 'life'

/** Home's workspaces, in the order the summary lists them. */
export const HOME_WORKSPACES: readonly HomeWorkspace[] = ['research', 'work', 'life']

/** The workspaces that have meetings (Life has none for now). */
export type MeetingHomeWorkspace = Exclude<HomeWorkspace, 'life'>

export interface HomeTask {
  uid: string
  title: string
  workspace: HomeWorkspace
  list: string
  /** A self-study task, shown as a training: a cap in front of its title, which is its training's name. */
  study: boolean
  /** The title of the task it is a subtask of (the row then reads `↳ parent · list`); null for any other. */
  parent: string | null
  /** The uid of that parent (null for any other task). */
  parentUid: string | null
  parentStatus: TaskStatus | null
  parentPriority: 'high' | 'normal' | 'low' | null
  /** That parent's due date, which its row names when it is not due itself. */
  parentDue: string | null
  due: string
  priority: 'high' | 'normal' | 'low'
  status: 'todo' | 'doing'
  /** Days past its due date (0 = due today). */
  daysLate: number
  route: string
}

export interface HomeMeeting {
  workspace: MeetingHomeWorkspace
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
  /** The workspace it belongs to, when the route does not say (a Watch item's route is its web address). */
  workspace?: HomeWorkspace
  /** HH:MM it ends, when known (a meeting or a training). */
  end?: string | null
  /** A meeting's attendees (full names), for "Meeting · with …". */
  attendees?: string[]
  /** A meeting's or training's format: `in-person` or `online`. */
  mode?: string | null
  /** Set on a task: what its status circle and priority mark show. */
  task?: {
    uid: string
    status: 'todo' | 'doing'
    priority: 'high' | 'normal' | 'low'
    parent: string | null
    /** The parent's uid, status, priority and due date, as on `HomeTask`, so a subtask can hang under its task. */
    parentUid: string | null
    parentStatus: TaskStatus | null
    parentPriority: 'high' | 'normal' | 'low' | null
    parentDue: string | null
    study: boolean
  }
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

/**
 * One workspace's time so far, as the Hours and Home pages show it: the stored year plus the hours the notes derive
 * (`periodFigures`, `shownYear`). The period is the week, or the invoice month of a Work contract.
 */
export interface HomeHours {
  label: 'This week' | 'This month'
  /** The period's minutes so far. */
  minutes: number
  /** The period's whole aim in minutes (0 = no aim). */
  aimMinutes: number
  todayMinutes: number
  /** Minutes per client in the period (Work, only those with time); none where the plan has no clients. */
  clients: { client: string | null; minutes: number }[]
}

/** Time so far for each workspace that tracks it; null when the workspace has no year holding today. */
export interface HomeHoursByWorkspace {
  research: HomeHours | null
  work: HomeHours | null
  life: HomeHours | null
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

/** One workspace's overdue and due-today tasks, each list cut to `SHOWN_TASKS`, with the whole counts. */
export interface HomeTasks {
  overdue: HomeTask[]
  today: HomeTask[]
  overdueTotal: number
  todayTotal: number
}

export interface WatchBrief {
  counts: WatchCounts
  /** The newest items not yet looked at (a few dozen at most), for the notification about what is new. */
  fresh: WatchItem[]
}

export interface HomeSummary {
  today: string
  generatedAt: string
  timer: HomeTimer | null
  hours: HomeHoursByWorkspace
  /** Each workspace's own lists and totals: one workspace's tasks never use another's slots. */
  tasks: Record<HomeWorkspace, HomeTasks>
  meetings: {
    next: HomeMeeting | null
    openTodos: number
  }
  upcoming: HomeEvent[]
  /** Each Watch workspace's brief; null where that workspace watches nothing. */
  watch: Record<WatchWorkspace, WatchBrief | null>
  /** Null when weather is off, has no place yet, or could not be read. */
  weather: WeatherSummary | null
}

export type { WatchKind }

export interface HomeApi {
  /** Everything the Home page shows, read now. */
  summary(): Promise<HomeSummary>
  /** The weather, read again (it is also part of `summary`); null when it is off. */
  weather(): Promise<WeatherSummary | null>
  /**
   * Asks Location Services for this Mac's position now (macOS asks for permission the first time), so Settings can say
   * whether Weather can work. The position itself never reaches the page.
   */
  locate(): Promise<WeatherAccess>
}

/** Whether the weather can find where this Mac is. */
export type WeatherAccess = 'ok' | 'denied' | 'unavailable'

export const HOME_IPC = {
  summary: 'home:summary',
  weather: 'home:weather',
  locate: 'home:locate'
} as const
