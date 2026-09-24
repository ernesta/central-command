import { $prose } from '@milkdown/kit/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

/**
 * Flip a task item's checkbox. `pos` is the position of the list item node.
 * Returns whether anything was toggled (false if the node is not a task item).
 */
export function toggleTask(view: EditorView, pos: number): boolean {
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'list_item' || typeof node.attrs.checked !== 'boolean')
    return false
  view.dispatch(view.state.tr.setNodeAttribute(pos, 'checked', !node.attrs.checked))
  return true
}

/**
 * Makes task-list checkboxes clickable. The checkbox itself is drawn by CSS in the
 * list item's left padding, so a click on the item's own box (not its text) toggles it.
 */
export const taskListToggle = $prose(
  () =>
    new Plugin({
      props: {
        handleClickOn(view, _pos, node, nodePos, event) {
          const target = event.target
          if (!(target instanceof HTMLElement) || target.tagName !== 'LI') return false
          if (node.type.name !== 'list_item' || typeof node.attrs.checked !== 'boolean')
            return false
          const gutter = parseFloat(getComputedStyle(target).paddingLeft) || 0
          if (event.offsetX > gutter) return false
          return toggleTask(view, nodePos)
        }
      }
    })
)
