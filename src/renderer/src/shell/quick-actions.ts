import type { NavigateFunction } from 'react-router'
import { meetingRoute } from '@modules/meetings/renderer/meetings-paths'
import { stopTimer } from '@modules/hours/renderer/start-request'
import { noteRoute } from '@modules/notes/renderer/notes-paths'
import { entryRoute } from '@modules/training/renderer/training-paths'
import { readingListRoute } from '@modules/reading-lists/renderer/reading-lists-paths'
import { taskRoute } from '@modules/tasks/renderer/tasks-paths'
import { defaultList } from '@modules/tasks/shared/query'
import type { DockActionId } from '@shared/api'
import { todayIso } from '@shared/time'

/** The ids the Dock menu can send (`DockActionId`) and the two only the palette and `new:` make: one list of "start something now" actions. */
export type QuickActionId = DockActionId | 'new-task' | 'new-reading-list'

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
    id: 'new-task',
    title: 'New task',
    detail: 'An empty task, in the list you used last.',
    go: async (navigate, current) => {
      const workspace = current === 'work' ? 'work' : 'research'
      const [tasks, clients, settings] = await Promise.all([
        window.api.tasks.list(workspace),
        window.api.tasks.clients(workspace),
        window.api.settings.get()
      ])
      const saved = settings.ui.moduleState[`tasks-last-list-${workspace}`] as
        { list?: unknown; sublist?: unknown } | undefined
      const last = {
        list: typeof saved?.list === 'string' ? saved.list : '',
        sublist: typeof saved?.sublist === 'string' ? saved.sublist : ''
      }
      const rows = tasks.filter((t) => !t.parentUid).map((task) => ({ task, kids: [] }))
      const where = defaultList(rows, { last, clients })
      // An ordinary task (never one the app made for a session); the page removes it if nothing is written in it.
      const task = await window.api.tasks.create({
        workspace,
        title: '',
        list: where.list,
        sublist: where.sublist,
        due: todayIso()
      })
      navigate(taskRoute(workspace, task.uid), { state: { isNew: true } })
    }
  },
  {
    id: 'new-reading-list',
    title: 'New reading list',
    // Reading lists live in Research only.
    detail: 'An untitled list, filled in at leisure.',
    go: async (navigate) => {
      const file = await window.api.readingLists.create({ workspace: 'research' })
      navigate(readingListRoute(file.ref.id), { state: { isNew: true } })
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
    title: 'New training',
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
