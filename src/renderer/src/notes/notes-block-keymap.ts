import { lift } from '@milkdown/kit/prose/commands'
import { undoInputRule } from '@milkdown/kit/prose/inputrules'
import { keymap } from '@milkdown/kit/prose/keymap'
import type { Command } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'

/**
 * Backspace at the very start of a quote's first block takes that block out of the quote instead of
 * merging it into whatever is above the quote. A later block of the quote joins upwards as usual.
 */
export const unwrapQuoteAtStart: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset !== 0 || $from.depth < 1) return false
  const container = $from.node($from.depth - 1)
  if (container.type.name !== 'blockquote' || $from.index($from.depth - 1) !== 0) return false
  return lift(state, dispatch)
}

/**
 * Backspace right after an input rule undoes it, so `### ` gives back the typed text rather than an
 * empty heading. Then a quote's first block leaves the quote. Registered before the default keymaps.
 */
export const blockBackspaceKeymap = $prose(() =>
  keymap({
    Backspace: (state, dispatch, view) =>
      undoInputRule(state, dispatch) || unwrapQuoteAtStart(state, dispatch, view)
  })
)
