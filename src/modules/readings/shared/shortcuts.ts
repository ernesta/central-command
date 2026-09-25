import type { ShortcutGroup } from '@shared/shortcuts'

export const READINGS_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Readings table',
    shortcuts: [
      { action: 'Move between readings', keys: ['ArrowUp', 'ArrowDown'] },
      { action: 'Move by a screenful', keys: ['PageUp', 'PageDown'] },
      { action: 'First or last reading', keys: ['Home', 'End'] },
      { action: 'Open the reading', keys: ['Enter'] }
    ]
  }
]
