import { Plugin } from '@milkdown/kit/prose/state'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $ctx, $prose } from '@milkdown/kit/utils'

/** Where the menu should open, and the text the chosen TODO replaces (the typed `/todo`, or nothing). */
export interface TodoMenuRequest {
  view: EditorView
  from: number
  to: number
}

export type MenuKey = 'up' | 'down' | 'enter' | 'escape'

/** How the plugin talks to the menu component. Set by `useTodoHelper` when the editor is created. */
export interface TodoMenuBridge {
  open(request: TodoMenuRequest): void
  close(): void
  isOpen(): boolean
  /** Returns true when the menu used the key. */
  key(key: MenuKey): boolean
}

const noMenu: TodoMenuBridge = {
  open: () => undefined,
  close: () => undefined,
  isOpen: () => false,
  key: () => false
}

export const todoMenuCtx = $ctx<TodoMenuBridge, 'todoMenu'>(noMenu, 'todoMenu')

const TRIGGER = '/todo'
const KEYS: Record<string, MenuKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'enter',
  Escape: 'escape',
  Tab: 'enter'
}

/**
 * Replace `[from, to)` with a bold `TODO(XX)` (or `TODO`) followed by a colon and a space, and put the
 * cursor after it, outside the bold. The Markdown that results is `**TODO(XX)**: `, which is exactly
 * what the TODO parser reads, so typing it by hand and using the helper are the same thing.
 */
export function insertTodo(view: EditorView, from: number, to: number, owner: string | null): void {
  const { schema } = view.state
  const strong = schema.marks.strong
  const label = owner ? `TODO(${owner})` : 'TODO'
  const nodes = [schema.text(label, strong ? [strong.create()] : []), schema.text(': ')]
  const tr = view.state.tr.replaceWith(from, to, nodes)
  const end = from + label.length + 2
  tr.setSelection(TextSelection.create(tr.doc, end)).setStoredMarks([])
  view.dispatch(tr)
  view.focus()
}

/** The text between the start of the current block and `pos`. */
function textBefore(view: EditorView, pos: number): string {
  const $pos = view.state.doc.resolve(pos)
  return $pos.parent.textBetween(0, $pos.parentOffset, undefined, '￼')
}

/**
 * The TODO helper: typing `/todo` (at the start of a line or after a space) or pressing Cmd/Ctrl+Shift+T
 * opens a menu of owners. While the menu is open it takes the arrow keys, Enter, Tab and Escape; any
 * other key closes it and is handled as normal, so typing keeps working.
 */
export const todoHelperPlugin = $prose((ctx) => {
  let bridge: TodoMenuBridge = noMenu
  return new Plugin({
    view: () => {
      bridge = ctx.get(todoMenuCtx.key)
      return {
        update(view, previous) {
          // Moving the cursor elsewhere closes the menu.
          if (bridge.isOpen() && !view.state.selection.eq(previous.selection)) {
            // Selection changes caused by our own dispatch happen after `close()`; others close here.
            bridge.close()
          }
        },
        destroy: () => bridge.close()
      }
    },
    props: {
      handleKeyDown(view, event) {
        if (bridge.isOpen()) {
          const key = KEYS[event.key]
          if (key && bridge.key(key)) {
            event.preventDefault()
            return true
          }
          if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1)
            bridge.close()
          if (event.key === 'Backspace') bridge.close()
          return false
        }
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't') {
          event.preventDefault()
          const { from, to } = view.state.selection
          bridge.open({ view, from, to })
          return true
        }
        return false
      },
      handleTextInput(view, from, to, text) {
        if (from !== to) return false
        const before = textBefore(view, from) + text
        if (!before.endsWith(TRIGGER)) return false
        const lead = before.slice(0, -TRIGGER.length)
        if (lead !== '' && !/\s$/.test(lead)) return false
        // Let the letter be typed, then open the menu over the whole `/todo`.
        setTimeout(() => {
          const end = from + text.length
          bridge.open({ view, from: end - TRIGGER.length, to: end })
        }, 0)
        return false
      }
    }
  })
})
