import { fold } from '@shared/text'
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
