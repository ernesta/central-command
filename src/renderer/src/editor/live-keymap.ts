import { keymap, type KeyBinding } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import {
  INLINE_KINDS,
  setHeading,
  setParagraph,
  toggleBullets,
  toggleCodeBlock,
  toggleInline,
  toggleNumbers,
  toggleQuote
} from './live-format'
import { deleteChip } from './live-entities'
import { openFind, replaceFromKey } from './live-find'
import { tableTab } from './live-tables'
import {
  backspaceInItem,
  deleteBeforeItem,
  enter,
  hardBreak,
  indentItem,
  outdentItem
} from './live-lists'

/*
 * The keys of the live editor, in the order of Settings → Shortcuts → Notes editor. `notes-shortcuts.test.ts` checks
 * that every chord listed there is bound here (or is marked as belonging to a later stage), and `live-keymap.test.ts`
 * presses each one and checks the text it leaves.
 */
export const formatBindings: KeyBinding[] = [
  { key: 'Mod-b', run: toggleInline(INLINE_KINDS.bold) },
  { key: 'Mod-i', run: toggleInline(INLINE_KINDS.italic) },
  { key: 'Mod-Alt-x', run: toggleInline(INLINE_KINDS.strike) },
  { key: 'Mod-e', run: toggleInline(INLINE_KINDS.code) },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({ key: `Mod-Alt-${level}`, run: setHeading(level) })),
  { key: 'Mod-Alt-0', run: setParagraph },
  { key: 'Mod-Alt-8', run: toggleBullets },
  { key: 'Mod-Alt-7', run: toggleNumbers },
  { key: 'Mod-Shift-b', run: toggleQuote },
  { key: 'Mod-Alt-c', run: toggleCodeBlock }
]

/** Find and replace: the bar is `useNotesFind`'s; Cmd-Enter and Cmd-Shift-Enter do nothing here unless the bar is open with its replace row. */
export const findBindings: KeyBinding[] = [
  { key: 'Mod-f', run: openFind(false) },
  { key: 'Mod-Alt-f', run: openFind(true) },
  { key: 'Mod-Enter', run: replaceFromKey(false) },
  { key: 'Mod-Shift-Enter', run: replaceFromKey(true) }
]

/** A mention is one thing to Backspace and Delete; before the list rules, which would treat the text after it as an item's. */
export const entityBindings: KeyBinding[] = [
  { key: 'Backspace', run: deleteChip(false) },
  { key: 'Delete', run: deleteChip(true) }
]

/** Tab and Shift-Tab move between the cells of a table; outside a table they are not handled here, and the list keys below run. */
export const tableBindings: KeyBinding[] = [
  { key: 'Tab', run: tableTab(true) },
  { key: 'Shift-Tab', run: tableTab(false) }
]

export const listBindings: KeyBinding[] = [
  { key: 'Enter', run: enter },
  { key: 'Shift-Enter', run: hardBreak },
  { key: 'Backspace', run: backspaceInItem },
  { key: 'Delete', run: deleteBeforeItem },
  { key: 'Tab', run: indentItem },
  { key: 'Shift-Tab', run: outdentItem },
  { key: 'Mod-]', run: indentItem },
  { key: 'Mod-[', run: outdentItem }
]

/** Every binding of the live editor, before the default keymap so that ours win (`Mod-[` and `Mod-]` are theirs too). */
export const liveKeymap: Extension = keymap.of([
  ...formatBindings,
  ...findBindings,
  ...entityBindings,
  ...tableBindings,
  ...listBindings
])
