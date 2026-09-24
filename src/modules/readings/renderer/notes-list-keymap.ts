import { keymap } from '@milkdown/kit/prose/keymap'
import { liftListItem } from '@milkdown/kit/prose/schema-list'
import type { Command } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'

/**
 * Backspace at the very start of a list item takes the item out of the list (turning it into a
 * paragraph), or outdents it one level if it is nested. This is how Typora and most editors behave.
 *
 * Without it, Backspace at the start of a bullet does nothing visible the first time, so a bullet
 * on the first line of a note seemed impossible to remove.
 */
export const liftListItemAtStart: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset !== 0) return false
  const item = $from.depth >= 1 ? $from.node($from.depth - 1) : null
  // Only the first block of an item: Backspace at the start of a later paragraph joins upwards as usual.
  if (!item || item.type.name !== 'list_item' || $from.index($from.depth - 1) !== 0) return false
  return liftListItem(item.type)(state, dispatch)
}

export const listBackspaceKeymap = $prose(() => keymap({ Backspace: liftListItemAtStart }))
