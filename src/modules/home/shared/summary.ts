import type { TimeOffEntry } from '@shared/tracking/types'
import { daysLate } from '../../tasks/shared/late'
import type { WatchItem } from '../../watch/shared/types'
import type {
  HomeEvent,
  HomeHoursByWorkspace,
  HomeMeeting,
  HomeSummary,
  HomeTask,
  HomeTimer,
  HomeWorkspace,
  WatchBrief,
  WeatherSummary
} from './types'

import type { TaskStatus } from '../../tasks/shared/types'

export interface TaskInput {
  uid: string
  title: string
  workspace: HomeWorkspace
  list: string
  /** The title of its parent, when it is a subtask shown with the `↳` line. */
  parent?: string | null
  /** The uid of that parent, to group a subtask under it. */
  parentUid?: string | null
  /** That parent's status and priority, for the row that heads the subtask when the parent is not due itself. */
  parentStatus?: TaskStatus | null
  parentPriority?: 'high' | 'normal' | 'low' | null
  parentDue?: string | null
  /** A self-study task: its `title` is already its training's name and its `list` says so. */
  study?: boolean
  due: string | null
  priority: 'high' | 'normal' | 'low'
  status: 'todo' | 'doing' | 'done'
}

export interface MeetingInput {
  workspace: HomeWorkspace
  id: string
  series: string
  date: string
  start: string | null
  end: string | null
  attendees: string[]
  mode: string | null
}

export interface TrainingInput {
  workspace: HomeWorkspace
  id: string
  title: string
  date: string
  start: string | null
  end: string | null
  mode: string | null
}

export interface HomeInputs {
  /** YYYY-MM-DD, and the minutes since midnight now (a meeting earlier today is no longer "next"). */
  today: string
  nowMinutes: number
  generatedAt: string
  /** Not-done tasks, any workspace. Done and trashed ones are the loader's business. */
  tasks: TaskInput[]
  /** Meetings dated today or later. */
  meetings: MeetingInput[]
  /** Training sessions dated today or later. */
  trainings: TrainingInput[]
  openMeetingTodos: number
  timer: HomeTimer | null
  hours: HomeHoursByWorkspace
  timeOff: TimeOffEntry[]
  watch: { counts: WatchBrief['counts']; relevant: WatchItem[]; upcoming: WatchItem[] } | null
  weather: WeatherSummary | null
}

/** How many of each list the page shows; the totals say how many there are. */
export const SHOWN_TASKS = 8
export const SHOWN_UPCOMING = 12
export const SHOWN_WATCH = 5
const TASKS_AHEAD_DAYS = 14
const MEETINGS_AHEAD_DAYS = 21
const TRAININGS_AHEAD_DAYS = 45
const TIME_OFF_AHEAD_DAYS = 45

const DAY_MS = 86_400_000
const dayIndex = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
export const daysFrom = (today: string, date: string): number => dayIndex(date) - dayIndex(today)

export const taskRoute = (workspace: HomeWorkspace, uid: string): string =>
  `/${workspace}/tasks/t/${uid}`
export const trainingRoute = (id: string): string =>
  `/research/training/t/${encodeURIComponent(id)}`
export const meetingRoute = (workspace: HomeWorkspace, id: string): string =>
  `/${workspace}/meetings/m/${encodeURIComponent(id)}`

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const

function toHomeTask(t: TaskInput, today: string): HomeTask | null {
  if (t.status === 'done' || !t.due) return null
  return {
    uid: t.uid,
    title: t.title,
    workspace: t.workspace,
    list: t.list,
    parent: t.parent ?? null,
    parentUid: t.parentUid ?? null,
    parentStatus: t.parentStatus ?? null,
    parentPriority: t.parentPriority ?? null,
    parentDue: t.parentDue ?? null,
    study: t.study ?? false,
    due: t.due,
    priority: t.priority,
    status: t.status,
    daysLate: daysLate(t.due, today),
    route: taskRoute(t.workspace, t.uid)
  }
}

/** Most overdue first, then by priority, then by title: what to look at before anything else. */
const byUrgency = (a: HomeTask, b: HomeTask): number =>
  b.daysLate - a.daysLate ||
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  a.title.localeCompare(b.title)

const toMeeting = (m: MeetingInput): HomeMeeting => ({
  ...m,
  route: meetingRoute(m.workspace, m.id)
})

/** Consecutive days off become one line ("Annual leave, 3 days"): the list reads as a calendar, not a spreadsheet. */
function timeOffRuns(
  entries: TimeOffEntry[],
  today: string
): { from: string; to: string; days: number; type: TimeOffEntry['type'] }[] {
  const days = entries
    .filter((e) => e.date >= today && daysFrom(today, e.date) <= TIME_OFF_AHEAD_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date))
  const runs: { from: string; to: string; days: number; type: TimeOffEntry['type'] }[] = []
  for (const e of days) {
    const last = runs[runs.length - 1]
    if (last && last.type === e.type && daysFrom(last.to, e.date) <= 1) {
      last.to = e.date
      last.days += 1
    } else runs.push({ from: e.date, to: e.date, days: 1, type: e.type })
  }
  return runs
}

const TIME_OFF_LABEL: Record<TimeOffEntry['type'], string> = {
  public: 'Public holiday',
  university: 'University closure',
  leave: 'Annual leave'
}

const KIND_LABEL: Record<WatchItem['kind'], string> = {
  conference: 'Conference',
  training: 'Training',
  'summer-school': 'Summer school',
  journal: 'Journal',
  listing: 'Listing',
  other: 'Watch'
}

/**
 * Everything the Home page shows, from data already read. Pure: no clock, no files, no network, so every rule
 * (what is overdue, what is next, what is coming up) is tested without an app.
 */
export function buildHomeSummary(input: HomeInputs): HomeSummary {
  const { today } = input
  const dated = input.tasks
    .map((t) => toHomeTask(t, today))
    .filter((t): t is HomeTask => t !== null)
  const overdue = dated.filter((t) => t.due < today).sort(byUrgency)
  const dueToday = dated.filter((t) => t.due === today).sort(byUrgency)

  const meetings = input.meetings
    .filter(
      (m) => m.date > today || (m.date === today && minutesOf(m.end ?? m.start) >= input.nowMinutes)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
  const nextMeeting = meetings[0] ? toMeeting(meetings[0]) : null

  // A training that is over today drops out the same way a meeting does.
  const trainings = input.trainings.filter(
    (t) => t.date > today || (t.date === today && minutesOf(t.end ?? t.start) >= input.nowMinutes)
  )

  const events: HomeEvent[] = []
  for (const t of dated) {
    const inDays = daysFrom(today, t.due)
    if (inDays >= 1 && inDays <= TASKS_AHEAD_DAYS)
      events.push({
        id: `task:${t.uid}`,
        kind: 'task',
        date: t.due,
        time: null,
        title: t.title,
        detail: t.list,
        route: t.route,
        inDays,
        task: {
          uid: t.uid,
          status: t.status,
          priority: t.priority,
          parent: t.parent,
          parentUid: t.parentUid,
          parentStatus: t.parentStatus,
          parentPriority: t.parentPriority,
          parentDue: t.parentDue,
          study: t.study ?? false
        }
      })
  }
  for (const m of meetings) {
    const inDays = daysFrom(today, m.date)
    if (inDays > MEETINGS_AHEAD_DAYS) continue
    events.push({
      id: `meeting:${m.workspace}:${m.id}`,
      kind: 'meeting',
      date: m.date,
      time: m.start,
      end: m.end,
      attendees: m.attendees,
      mode: m.mode,
      title: m.series || 'Untitled meeting',
      detail: '',
      route: meetingRoute(m.workspace, m.id),
      inDays
    })
  }
  for (const t of trainings) {
    const inDays = daysFrom(today, t.date)
    if (inDays < 0 || inDays > TRAININGS_AHEAD_DAYS) continue
    events.push({
      id: `training:${t.id}`,
      kind: 'training',
      date: t.date,
      time: t.start,
      end: t.end,
      mode: t.mode,
      title: t.title || 'Untitled training',
      detail: '',
      route: trainingRoute(t.id),
      inDays
    })
  }
  for (const run of timeOffRuns(input.timeOff, today)) {
    events.push({
      id: `off:${run.from}`,
      kind: 'time-off',
      date: run.from,
      time: null,
      title: TIME_OFF_LABEL[run.type],
      detail: run.days > 1 ? `${run.days} days, to ${run.to}` : '',
      route: '/research/time-off',
      inDays: daysFrom(today, run.from)
    })
  }
  // Only what the user saved: an unsaved item's date never reaches "Coming up" or a notification (the loader asks for
  // saved items only; this keeps the rule even when it is handed more).
  for (const w of input.watch?.upcoming ?? []) {
    if (!w.date || w.state !== 'saved') continue
    events.push({
      id: `watch:${w.id}`,
      kind: w.dateKind === 'deadline' ? 'deadline' : 'event',
      date: w.date,
      time: null,
      title: w.title,
      detail: `${KIND_LABEL[w.kind]} · ${w.sourceTitle}`,
      route: w.url,
      inDays: daysFrom(today, w.date)
    })
  }
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '').localeCompare(b.time ?? '') ||
      a.title.localeCompare(b.title)
  )

  return {
    today,
    generatedAt: input.generatedAt,
    timer: input.timer,
    hours: input.hours,
    tasks: {
      overdue: overdue.slice(0, SHOWN_TASKS),
      today: dueToday.slice(0, SHOWN_TASKS),
      overdueTotal: overdue.length,
      todayTotal: dueToday.length
    },
    meetings: { next: nextMeeting, openTodos: input.openMeetingTodos },
    // Everything dated today is kept (Home's "Today" lists it); the rest fills the days ahead.
    upcoming: [
      ...events.filter((e) => e.inDays <= 0),
      ...events.filter((e) => e.inDays > 0).slice(0, SHOWN_UPCOMING)
    ],
    watch: input.watch
      ? { counts: input.watch.counts, relevant: input.watch.relevant.slice(0, SHOWN_WATCH) }
      : null,
    weather: input.weather
  }
}

/** Minutes since midnight of an HH:MM time; a meeting with no time is treated as lasting all day. */
function minutesOf(time: string | null): number {
  const m = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : null
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60
}
