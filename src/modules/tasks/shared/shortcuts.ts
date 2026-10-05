import type { ShortcutGroup } from '@shared/shortcuts'

/** Starts a new task from anywhere in the app. */
export const NEW_TASK_SHORTCUT = 'Mod-Shift-a'

export const TASKS_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Tasks',
    shortcuts: [
      {
        action: 'Add a task',
        keys: [NEW_TASK_SHORTCUT],
        note: 'From anywhere in the app. The task starts in the workspace and list you are looking at.'
      },
      {
        action: 'Move a task on to the next status',
        keys: ['Space'],
        note: 'On a row in a list of tasks: to do, in progress, done.'
      },
      {
        action: 'Open or close a task’s subtasks',
        keys: ['ArrowRight', 'ArrowLeft'],
        note: 'On a row with subtasks.'
      },
      {
        action: 'Open the row menu (status, priority, add a subtask)',
        keys: ['Shift-F10'],
        note: 'Or the menu key; the same as a right-click.'
      }
    ]
  }
]
