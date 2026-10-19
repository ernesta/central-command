import type { NavigateFunction } from 'react-router'
import { meetingRoute } from '@modules/meetings/renderer/meetings-paths'
import { stopTimer } from '@modules/hours/renderer/start-request'
import { noteRoute } from '@modules/notes/renderer/notes-paths'
import { entryRoute } from '@modules/training/renderer/training-paths'
import type { DockActionId } from '@shared/api'
import { todayIso } from '@shared/time'

/** The same three ids the Dock menu can send (`DockActionId`): one list of "start something now" actions. */
export type QuickActionId = DockActionId

export interface QuickAction {
  id: QuickActionId
  title: string
  detail: string
  go: (navigate: NavigateFunction, workspace: QuickActionWorkspace) => void | Promise<void>
}

/** Where a quick action starts things: the workspace being looked at, Research anywhere else. */
export type QuickActionWorkspace = 'life' | 'research' | 'work'

/** Meetings have no Life: they start in Work when looking at Work, else in Research. */
export function researchOrWork(workspace: QuickActionWorkspace): 'research' | 'work' {
  return workspace === 'work' ? 'work' : 'research'
}

/**
 * The workspace of the page (`/work/…`). A page outside any workspace (the search results, Settings) uses the
 * `remembered` one, the workspace last visited.
 */
export function quickActionWorkspace(pathname: string, remembered = ''): QuickActionWorkspace {
  const segment = pathname.split('/')[1]
  const known = ['life', 'research', 'work']
  const chosen = known.includes(segment) ? segment : remembered
  return known.includes(chosen) ? (chosen as QuickActionWorkspace) : 'research'
}

/**
 * The three "start something now" actions: what the command palette offers under those names, what the Dock
 * menu's quick actions run (macOS), and what each module's own "New …" button already does. One place, so
 * there is only ever one way a meeting, a training entry or a note gets created.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'new-note',
    title: 'New note',
    detail: 'Starts now, in the group you are looking at.',
    go: async (navigate, workspace) => {
      const file = await window.api.notes.create({ workspace })
      navigate(noteRoute(workspace, file.ref.id), { state: { focus: 'body' } })
    }
  },
  {
    id: 'new-meeting',
    title: 'New meeting',
    detail: 'Starts today, filled in at leisure.',
    go: async (navigate, current) => {
      const workspace = researchOrWork(current)
      const file = await window.api.meetings.create({
        workspace,
        date: todayIso(),
        task: 'auto'
      })
      navigate(meetingRoute(workspace, file.ref.id))
    }
  },
  {
    id: 'stop-timer',
    title: 'Stop timer',
    detail: 'Ends the task that is running; asks for a task if it has none.',
    go: () => stopTimer()
  },
  {
    id: 'new-training',
    title: 'New training entry',
    // Training has no Work: it starts in Life when looking at Life, else in Research.
    detail: 'Starts today, filled in at leisure.',
    go: async (navigate, current) => {
      const workspace = current === 'life' ? 'life' : 'research'
      const file = await window.api.training.create({
        workspace,
        title: 'Untitled',
        date: todayIso(),
        // Research's entries make their own subtask for the training's hours; Life has none.
        ...(workspace === 'research' ? { task: 'auto' as const } : {})
      })
      navigate(entryRoute(file.ref.id, workspace), { state: { isNew: true } })
    }
  }
]

export function runQuickAction(
  id: QuickActionId,
  navigate: NavigateFunction,
  workspace: QuickActionWorkspace = 'research'
): void | Promise<void> {
  return QUICK_ACTIONS.find((a) => a.id === id)?.go(navigate, workspace)
}
