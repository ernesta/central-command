import type { NavigateFunction } from 'react-router'
import { meetingRoute } from '@modules/meetings/renderer/meetings-paths'
import { defaultSeries } from '@modules/meetings/shared/types'
import { openNewTask } from '@modules/tasks/renderer/new-task-store'
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

/** Where a quick action starts things: the workspace being looked at, Research anywhere else (Life has none). */
export type QuickActionWorkspace = 'research' | 'work'

/**
 * The workspace of the page (`/work/…`). A page outside any workspace (the search results, Settings) uses the
 * `remembered` one, the workspace last visited.
 */
export function quickActionWorkspace(pathname: string, remembered = ''): QuickActionWorkspace {
  const segment = pathname.split('/')[1]
  return (segment === 'work' || segment === 'research' ? segment : remembered) === 'work'
    ? 'work'
    : 'research'
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
    go: async (navigate, workspace) => {
      const file = await window.api.meetings.create({
        workspace,
        series: defaultSeries(workspace),
        date: todayIso()
      })
      navigate(meetingRoute(workspace, file.ref.id))
    }
  },
  {
    id: 'new-task',
    title: 'New task',
    detail: 'Opens the task form, in the list you are looking at.',
    go: (_navigate, workspace) => openNewTask({ workspace })
  },
  {
    id: 'stop-timer',
    title: 'Stop timer',
    detail: 'Ends the task that is running.',
    go: async () => {
      await window.api.tracking.stop()
    }
  },
  {
    id: 'new-training',
    title: 'New training entry',
    // Training exists only in Research, so this starts there from anywhere.
    detail: 'Starts today, filled in at leisure.',
    go: async (navigate) => {
      const file = await window.api.training.create({
        workspace: 'research',
        title: 'Untitled',
        date: todayIso()
      })
      navigate(entryRoute(file.ref.id), { state: { isNew: true } })
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
