import { formatClock } from '@shared/locale-names'
import { formatShortDate } from '@shared/time'
import { daysFrom, taskRoute } from '../shared/summary'
import type { HomeEvent, HomeSummary, HomeTask, HomeWorkspace } from '../shared/types'

/** "Coming up" looks this many days ahead, today included. */
export const COMING_UP_DAYS = 3

export interface HomeView {
  tasks: {
    overdue: HomeTask[]
    today: HomeTask[]
    /** The summary caps each list, so when it is cut short the counts here are not the whole story. */
    cut: boolean
  }
  /** Today's timed meetings and trainings first (time order), then the rest of what is dated today. */
  todayEvents: HomeEvent[]
  /** From tomorrow on. */
  comingUp: HomeEvent[]
  today: string
}

const isHere = (workspace: HomeWorkspace, route: string): boolean =>
  route.startsWith(`/${workspace}/`)

/** "13:45–15:00", or "13:45" when the end is not known. */
export function timeRange(time: string, end: string | null | undefined): string {
  return end && end !== time ? `${formatClock(time)}–${formatClock(end)}` : formatClock(time)
}

/** The time at the right of an event's row ("13:45–15:00"), nothing for an all-day item. */
export const whenLabel = (time: string | null, end?: string | null): string =>
  time ? timeRange(time, end) : ''

/** Which day, for the end of an event's second line: "tomorrow", "in 4 days"; nothing for today, whose rows sit under "Today". */
export function dayLabel(inDays: number): string {
  if (inDays <= 0) return ''
  return inDays === 1 ? 'tomorrow' : `in ${inDays} days`
}

const MODE_LABEL: Record<string, string> = { 'in-person': 'In person', online: 'Online' }

/** An event's second line: "Meeting · with AB, CD · tomorrow", "Training · Online · in 2 days"; the other kinds say what the summary gave. */
export function eventDetail(event: HomeEvent, initialsOf: (name: string) => string | null): string {
  const day = dayLabel(event.inDays)
  const text = eventKindDetail(event, initialsOf)
  if (!day) return text
  return text ? `${text} · ${day}` : day.charAt(0).toUpperCase() + day.slice(1)
}

function eventKindDetail(event: HomeEvent, initialsOf: (name: string) => string | null): string {
  if (event.kind === 'meeting') {
    const who = (event.attendees ?? []).map(initialsOf).filter((i): i is string => i !== null)
    return who.length > 0 ? `Meeting · with ${who.join(', ')}` : 'Meeting'
  }
  if (event.kind === 'training') {
    const mode = event.mode ? MODE_LABEL[event.mode] : undefined
    return mode ? `Training · ${mode}` : 'Training'
  }
  return detailText(event.detail)
}

/** The one workspace's share of the summary, which holds both: its tasks, and what is dated in the next 3 days. */
export function homeView(summary: HomeSummary, workspace: HomeWorkspace): HomeView {
  const { tasks } = summary
  const mine = (t: HomeTask): boolean => t.workspace === workspace
  const here = summary.upcoming.filter((e) => isHere(workspace, e.route))
  // Watch's items (their routes are web addresses) are not on Home yet, so they are left out rather than shown without a place to go.
  const comingUp = here.filter((e) => e.inDays >= 1 && e.inDays <= COMING_UP_DAYS)
  // The summary is sorted by date then time; an untimed item (a day off) follows the timed ones.
  const todayEvents = here
    .filter((e) => e.inDays <= 0)
    .sort(
      (a, b) =>
        Number(a.time === null) - Number(b.time === null) ||
        (a.time ?? '').localeCompare(b.time ?? '')
    )

  return {
    tasks: {
      overdue: tasks.overdue.filter(mine),
      today: tasks.today.filter(mine),
      cut: tasks.overdue.length < tasks.overdueTotal || tasks.today.length < tasks.todayTotal
    },
    todayEvents,
    comingUp,
    today: summary.today
  }
}

/** The line under an item; a run of days off ends "to 2026-10-21" in the summary, which reads better as "to 21 Oct" (or "to Oct 21"). */
export function detailText(detail: string): string {
  return detail.replace(/\b\d{4}-\d{2}-\d{2}\b/, (date) => formatShortDate(date))
}

/** A task of Today with the subtasks of it that are due too; `context` is a parent that is not itself due (it only names the group). */
export interface TaskGroup {
  head: HomeTask | null
  context: HomeTask | null
  kids: HomeTask[]
}

/** Today's tasks as the Tasks table shows them: a task, then its subtasks under it. A group sits where its task is, or where its first subtask is when the task itself is not due. */
export function groupTasks(tasks: HomeTask[], today: string): TaskGroup[] {
  const groups: TaskGroup[] = []
  const byParent = new Map<string, TaskGroup>()
  for (const t of tasks) if (!t.parentUid) byParent.set(t.uid, { head: t, context: null, kids: [] })
  for (const t of tasks) {
    if (!t.parentUid) {
      groups.push(byParent.get(t.uid)!)
      continue
    }
    let g = byParent.get(t.parentUid)
    if (!g) {
      g = {
        head: null,
        context: {
          ...t,
          uid: t.parentUid,
          title: t.parent ?? '',
          parent: null,
          parentUid: null,
          // A done parent keeps its done circle; the row only ever hands the status to the circle.
          status: (t.parentStatus ?? 'todo') as HomeTask['status'],
          priority: t.parentPriority ?? 'normal',
          due: t.parentDue ?? '',
          parentDue: null,
          daysLate: t.parentDue && t.parentDue < today ? daysFrom(t.parentDue, today) : 0,
          route: taskRoute(t.workspace, t.parentUid)
        },
        kids: []
      }
      byParent.set(t.parentUid, g)
      groups.push(g)
    }
    g.kids.push(t)
  }
  return groups
}

/** A row of Coming up: an event as it is, or a task with its due subtasks hung under it. */
export type ComingUpItem =
  { event: HomeEvent; group?: undefined } | { group: TaskGroup; event?: undefined }

/** A task's event as the task it stands for, so Today's grouping serves Coming up too (`daysLate` 0: nothing in the window is late). */
function taskOfEvent(e: HomeEvent, workspace: HomeWorkspace): HomeTask {
  const t = e.task!
  return {
    uid: t.uid,
    title: e.title,
    workspace,
    list: e.detail,
    study: t.study,
    parent: t.parent,
    parentUid: t.parentUid,
    parentStatus: t.parentStatus,
    parentPriority: t.parentPriority,
    parentDue: t.parentDue,
    due: e.date,
    priority: t.priority,
    status: t.status,
    daysLate: 0,
    route: e.route
  }
}

/**
 * Coming up as rows: tasks grouped as in Today (a group sits where its first task is), meetings, trainings and days off as they are.
 * A task's route says its workspace.
 */
export function comingUpItems(
  events: HomeEvent[],
  workspace: HomeWorkspace,
  today: string
): ComingUpItem[] {
  const groups = groupTasks(
    events.filter((e) => e.task).map((e) => taskOfEvent(e, workspace)),
    today
  )
  const groupOf = new Map<string, TaskGroup>()
  for (const g of groups) for (const k of [g.head, ...g.kids]) if (k) groupOf.set(k.uid, g)
  const seen = new Set<TaskGroup>()
  const items: ComingUpItem[] = []
  for (const e of events) {
    if (!e.task) {
      items.push({ event: e })
      continue
    }
    const g = groupOf.get(e.task.uid)!
    if (seen.has(g)) continue
    seen.add(g)
    items.push({ group: g })
  }
  return items
}
