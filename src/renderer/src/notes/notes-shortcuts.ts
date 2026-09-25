import { RANGE_KEY, type ShortcutGroup } from '@shared/shortcuts'

/**
 * The keys of the notes editor (Readings notes and meeting notes), for the Settings list. Most come from
 * Milkdown's CommonMark and GFM presets and its history plugin; `notes-shortcuts.test.ts` checks each one
 * against Milkdown's own source, so an upgrade that changes a key fails a test instead of leaving the list
 * wrong. The rest are ours (`notes-list-keymap.ts`).
 */
export const NOTES_EDITOR_SHORTCUTS: ShortcutGroup = {
  title: 'Notes editor',
  shortcuts: [
    { action: 'Bold', keys: ['Mod-b'] },
    { action: 'Italic', keys: ['Mod-i'] },
    { action: 'Strikethrough', keys: ['Mod-Alt-x'] },
    { action: 'Inline code', keys: ['Mod-e'] },
    { action: 'Heading 1 to 6', keys: [`Mod-Alt-${RANGE_KEY}`] },
    { action: 'Plain paragraph', keys: ['Mod-Alt-0'] },
    { action: 'Bulleted list', keys: ['Mod-Alt-8'] },
    { action: 'Numbered list', keys: ['Mod-Alt-7'] },
    { action: 'Quote', keys: ['Mod-Shift-b'] },
    { action: 'Code block', keys: ['Mod-Alt-c'] },
    { action: 'New line inside a paragraph', keys: ['Shift-Enter'] },
    { action: 'Indent a list item or move to the next table cell', keys: ['Tab', 'Mod-]'] },
    {
      action: 'Move a list item out a level or to the previous table cell',
      keys: ['Shift-Tab', 'Mod-[']
    },
    {
      action: 'Take a list item out of the list',
      keys: ['Backspace'],
      note: 'At the very start of the item.'
    },
    { action: 'Undo', keys: ['Mod-z'] },
    { action: 'Redo', keys: ['Shift-Mod-z', 'Mod-y'] }
  ]
}
