import { fold } from '@shared/text'
import { formatDate } from '@shared/time'
import type { Task } from '../../tasks/shared/types'
import type { MeetingWorkspace } from './types'

/** Research keeps its meeting tasks together in one list of its own. */
export const RESEARCH_MEETINGS_LIST = 'Meetings'

/** The task a meeting's series calls for: its generic title and list, and the open task that already is it (if any). */
export interface TaskProposal {
  title: string
  list: string
  existing: Task | null
}

/**
 * The generic task for a meeting series, never one with a person in it (the attendees stay on the note).
 *
 * - Research: the series itself ("Supervision", "Rastle Lab", "Luminos"), in the list "Meetings"; the catch-all "Other" is "Meetings".
 * - Work: the series is a client, so "<Client> meetings" in that client's own list (Work's lists are its clients). A series that
 *   is no client has no proposal: the task is chosen, and the picker asks which client.
 *
 * `clients` is Work's list of clients (null in Research). An existing task is an open top-level one with that title, in that list
 * first, else in any list (Research) so a task the user already made is taken up rather than duplicated.
 */
export function proposeMeetingTask(
  workspace: MeetingWorkspace,
  series: string,
  clients: readonly string[] | null,
  open: readonly Task[]
): TaskProposal | null {
  const name = series.trim()
  if (!name) return null
  let title: string
  let list: string
  if (workspace === 'work') {
    const client = (clients ?? []).find((c) => fold(c) === fold(name))
    if (!client) return null
    title = `${client} meetings`
    list = client
  } else {
    title = fold(name) === fold('Other') ? 'Meetings' : name
    list = RESEARCH_MEETINGS_LIST
  }
  const same = open.filter((t) => !t.parentUid && fold(t.title.trim()) === fold(title))
  const existing =
    same.find((t) => fold(t.list) === fold(list)) ??
    (workspace === 'work' ? null : (same[0] ?? null))
  return { title, list: existing?.list || list, existing }
}

/** The series task a meeting's subtask sits under: one that exists, or the one to create. */
export type MeetingParent = { uid: string } | { title: string; list: string }

/** What a meeting note's task needs done now. Pure: it only says, the page does it. */
export type MeetingPlan =
  | { kind: 'none' }
  /** A marked note with a date and a series task to sit under: make the subtask. */
  | { kind: 'create'; title: string; parent: MeetingParent }
  /** The subtask follows the note: its title, and the series task it sits under. */
  | { kind: 'sync'; uid: string; title?: string; parent?: MeetingParent }

export interface MeetingNote {
  /** The note's `task:` value: a task uid, `auto` or ''. */
  task: string
  series: string
  date: string
}

/** The title a meeting's subtask has: its series task and the date ("Supervision · Oct 12, 2026"). */
export function meetingTaskTitle(parentTitle: string, date: string): string {
  return `${parentTitle.trim()} · ${formatDate(date)}`
}

/** A title this module made: it ends in " · Oct 12, 2026". Anything else on a meeting is a task the user chose, never renamed. */
const DATED_TITLE = / · [A-Z][a-z]{2} \d{1,2}, \d{4}$/

function target(proposal: TaskProposal): MeetingParent {
  return proposal.existing
    ? { uid: proposal.existing.uid }
    : { title: proposal.title, list: proposal.list }
}

/**
 * What a meeting note's task needs. Like a training's lecture task, with no clicking:
 *
 * - An older note (`task` empty) is left alone, always.
 * - A marked note (`auto`) gets a subtask once it has a date and its series names a task (`proposeMeetingTask`: found, or made).
 *   Work's series that is no client has none, so nothing is made.
 * - The subtask then follows the note: titled "<series task> · <date>", under the task the series names.
 * - A task the user chose is never renamed or moved: only a subtask whose title this module made is the meeting's own. A task
 *   that is gone is not made again by itself.
 *
 * `tasks` is every task of the workspace (subtasks too); `clients` is Work's clients (null in Research).
 */
export function planMeetingTask(
  workspace: MeetingWorkspace,
  note: MeetingNote,
  clients: readonly string[] | null,
  tasks: readonly Task[]
): MeetingPlan {
  if (!note.task || !note.date) return { kind: 'none' }
  const open = tasks.filter((t) => t.status !== 'done')
  const proposal = proposeMeetingTask(workspace, note.series, clients, open)
  if (note.task === 'auto') {
    return proposal
      ? {
          kind: 'create',
          title: meetingTaskTitle(proposal.title, note.date),
          parent: target(proposal)
        }
      : { kind: 'none' }
  }
  const own = tasks.find((t) => t.uid === note.task)
  if (!own || !own.parentUid || !DATED_TITLE.test(own.title) || !proposal) return { kind: 'none' }
  const parent = tasks.find((t) => t.uid === own.parentUid)
  const parentOk = !!parent && fold(parent.title.trim()) === fold(proposal.title)
  const plan: { kind: 'sync'; uid: string; title?: string; parent?: MeetingParent } = {
    kind: 'sync',
    uid: own.uid
  }
  if (!parentOk) plan.parent = target(proposal)
  const title = meetingTaskTitle(proposal.title, note.date)
  if (title !== own.title) plan.title = title
  return plan.title === undefined && plan.parent === undefined ? { kind: 'none' } : plan
}
