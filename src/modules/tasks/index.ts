import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { TASKS_SHORTCUTS } from './shared/shortcuts'
import type { TaskWorkspace } from './shared/types'
import { taskEntities } from './renderer/entities'
import { searchTasks } from './renderer/search'
import { TaskGlobals } from './renderer/TaskGlobals'
import { TaskPage } from './renderer/TaskPage'
import { TasksCard } from './renderer/TasksCard'
import { TasksLanding } from './renderer/TasksLanding'
import { TasksPage } from './renderer/TasksPage'

/**
 * Tasks: a task manager of the app's own (it replaces ClickUp), in SQLite. Registered once per workspace
 * (`src/modules/index.ts`); each instance shows only its own workspace's tasks. The shortcut, the New task dialog and the
 * messages belong to the app, not a workspace, so only the 'research' instance carries them.
 */
export function createTasksModule(workspace: TaskWorkspace): LiveModuleManifest {
  return {
    id: 'tasks',
    workspace,
    label: 'Tasks',
    status: 'live',
    routes: [
      { path: '', element: createElement(TasksLanding) },
      { path: 'all', element: createElement(TasksPage) },
      { path: 't/:uid', element: createElement(TaskPage) }
    ],
    landingCard: TasksCard,
    search: searchTasks(workspace),
    ...(workspace === 'research'
      ? { globals: TaskGlobals, shortcuts: TASKS_SHORTCUTS, entities: [taskEntities] }
      : {})
  }
}
