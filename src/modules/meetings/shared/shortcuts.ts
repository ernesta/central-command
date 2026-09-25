import type { ShortcutGroup } from '@shared/shortcuts'

/** Opens the TODO owner menu in a meeting's notes (typing `/todo` does the same). */
export const TODO_SHORTCUT = 'Mod-Shift-t'

export const MEETINGS_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Meeting notes',
    shortcuts: [
      {
        action: 'Add a TODO for someone',
        keys: [TODO_SHORTCUT],
        note: 'Or type /todo at the start of a line or after a space.'
      },
      {
        action: 'Move through the owner menu',
        keys: ['ArrowUp', 'ArrowDown'],
        note: 'Enter or Tab picks the highlighted person; Escape closes the menu.'
      }
    ]
  },
  {
    title: 'Meetings list',
    shortcuts: [
      { action: 'Move between meetings', keys: ['ArrowUp', 'ArrowDown'] },
      { action: 'Move by a screenful', keys: ['PageUp', 'PageDown'] },
      { action: 'First or last meeting', keys: ['Home', 'End'] },
      { action: 'Open the meeting', keys: ['Enter'] }
    ]
  }
]
