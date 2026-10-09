import { RANGE_KEY, type ShortcutGroup } from '@shared/shortcuts'
import {
  FIND_SHORTCUT,
  REPLACE_ALL_SHORTCUT,
  REPLACE_ONE_SHORTCUT,
  REPLACE_TOGGLE_SHORTCUT
} from './find-types'

/**
 * The keys of the notes editor (every note, meeting, training entry, reading list and Readings note), for the Settings
 * list. `notes-shortcuts.test.ts` checks that the editor's keymap (`editor/live-keymap.ts`) binds every one, so a key
 * that is listed but not bound fails a test instead of leaving the list wrong.
 */
/** Opens the TODO owner menu in any note (typing `/todo` does the same). */
export const TODO_SHORTCUT = 'Mod-Shift-t'

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
    {
      action: 'Open a link',
      keys: ['Mod-Click'],
      note: 'A plain click puts the cursor in the link.'
    },
    {
      action: 'Mention a person, reading, meeting or note',
      keys: ['@'],
      note: 'Type @ and a few letters. Arrows choose, Enter or Tab links, Escape closes. Cmd-click a mention to open it.'
    },
    {
      action: 'Link the selected text',
      keys: ['Mod-v'],
      note: 'Paste a web address while text is selected. Typing [text](address) also makes a link.'
    },
    {
      action: 'Paste without formatting',
      keys: ['Mod-Shift-v'],
      note: 'Works in every text field.'
    },
    {
      action: 'Find in the note',
      keys: [FIND_SHORTCUT],
      note: 'Enter goes to the next match, Shift-Enter to the previous.'
    },
    { action: 'Find and replace in the note', keys: [REPLACE_TOGGLE_SHORTCUT] },
    { action: 'Replace this match', keys: [REPLACE_ONE_SHORTCUT] },
    { action: 'Replace every match', keys: [REPLACE_ALL_SHORTCUT] },
    {
      action: 'Add a TODO for someone',
      keys: [TODO_SHORTCUT],
      note: 'Or type /todo at the start of a line or after a space. Arrows choose, Enter or Tab picks, Escape closes.'
    },
    { action: 'Undo', keys: ['Mod-z'] },
    { action: 'Redo', keys: ['Shift-Mod-z', 'Mod-y'] }
  ]
}
