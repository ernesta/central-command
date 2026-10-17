import type { ShortcutGroup } from '@shared/shortcuts'

/** Opens the New task dialog from anywhere (not listed or mounted while the dialog is off; see `TaskGlobals`). */
export const NEW_TASK_SHORTCUT = 'Mod-Shift-a'

export const TASKS_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Tasks',
    shortcuts: [
      {
        action: 'Move a task on to the next status',
        keys: ['Space'],
        note: 'On a row in a list of tasks: to do, in progress, done.'
      },
      {
        action: 'Move a task back to the previous status',
        keys: ['Shift-Space'],
        note: 'Or Shift-click the status icon.'
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
