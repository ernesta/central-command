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
export const liveKeymap: Extension = keymap.of([...formatBindings, ...listBindings])
