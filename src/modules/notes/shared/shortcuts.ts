import type { ShortcutGroup } from '@shared/shortcuts'

/** Starts a new note from anywhere in the app. */
export const QUICK_CAPTURE_SHORTCUT = 'Mod-Shift-n'

export const NOTES_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Notes',
    shortcuts: [
      {
        action: 'Start a new note',
        keys: [QUICK_CAPTURE_SHORTCUT],
        note: 'From anywhere in the app. The note starts in the group you are looking at.'
      }
    ]
  }
]
