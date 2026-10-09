import { EditorSelection, Prec, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { treeTo } from './live-lines'
import { matchesShortcut } from '@shared/shortcuts'
import { TODO_SHORTCUT } from '../notes/notes-shortcuts'

/**
 * Where the menu should open, and the text the chosen TODO replaces (the typed `/todo`, or nothing). Made by the editor
 * (`liveTodoHelper`), so the menu component does not know about CodeMirror.
 */
export interface TodoMenuRequest {
  from: number
  to: number
  /** Where the menu goes: the bottom left of the text it is for, in viewport pixels. */
  at: { left: number; bottom: number }
  /** Write the TODO (for this owner's initials, or none) in place of `[from, to)` and put the cursor after it. */
  insert(owner: string | null): void
}

export type MenuKey = 'up' | 'down' | 'enter' | 'escape'

/** How the editor talks to the menu component. Set by `useTodoHelper` when the editor is created. */
export interface TodoMenuBridge {
  open(request: TodoMenuRequest): void
  close(): void
  isOpen(): boolean
  /** Returns true when the menu used the key. */
  key(key: MenuKey): boolean
  /** Text typed while the menu is open: it searches the people, and never reaches the note. */
  type(text: string): void
  /** Backspace while the menu is open: returns true when it removed a typed letter (false: the menu has none, so it closes). */
  backspace(): boolean
}

/*
 * The TODO helper: typing `/todo` (at the
 * start of a line or after a space) or pressing Cmd/Ctrl+Shift+T opens the menu of owners, which is `useTodoHelper`'s and
 * knows nothing of the editor. While it is open it takes the arrow keys, Enter, Tab and Escape, and what is typed
 * searches the people (the note does not change); Backspace on an empty search or moving the cursor closes it. Choosing writes `- [ ] **TODO(XX)**: ` (on a new line when typed mid-line).
 */

const TRIGGER = '/todo'
const KEYS: Record<string, MenuKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'enter',
  Escape: 'escape',
  Tab: 'enter'
}

/**
 * How a TODO is written after `before`, the text before it on its line: a checkbox item on an empty line, `[ ] ` after a
 * bullet or number already there, plain text in a checkbox, a quote or a table row, and a new checkbox item on the next line
 * in the middle of a line (a checkbox can only start a line).
 */
function leadFor(before: string): { lead: string; split: boolean } {
  if (/^\s*$/.test(before)) return { lead: '- [ ] ', split: false }
  if (/^\s*(?:[-*+]|\d+[.)])\s+$/.test(before)) return { lead: '[ ] ', split: false }
  if (/^\s*(?:(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+|[>|])/.test(before))
    return { lead: '', split: false }
  return { lead: '- [ ] ', split: true }
}

/**
 * Replace `[from, to)` with a bold `TODO(XX)` (or `TODO`) followed by a colon and a space, and put the cursor after it, outside
 * the bold. The TODO is written as a checkbox (`- [ ] **TODO(XX)**: `) so it can be ticked in the note and from the Meetings
 * page; typed in the middle of a line it starts a new line (the spaces before it go). What results is what the TODO parser
 * reads, so typing it by hand and using the helper are the same thing.
 */
export function insertTodoText(
  view: EditorView,
  from: number,
  to: number,
  owner: string | null
): void {
  const line = view.state.doc.lineAt(from)
  const before = view.state.sliceDoc(line.from, from)
  const { lead, split } = leadFor(before)
  const marker = `**${owner ? `TODO(${owner})` : 'TODO'}**: `
  const start = split ? from - (before.length - before.trimEnd().length) : from
  const text = split
    ? `${view.state.lineBreak}${/^\s*/.exec(before)?.[0] ?? ''}${lead}${marker}`
    : lead + marker
  view.dispatch({
    changes: { from: start, to, insert: text },
    selection: EditorSelection.cursor(start + text.length),
    scrollIntoView: true,
    userEvent: 'input.complete'
  })
  view.focus()
}

const NOT_A_PLACE_FOR_A_TODO = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'CodeText'])

/**
 * Whether `/todo` ends exactly at `pos`, at the start of the line or after white space, and not in code. Returns where it starts.
 */
export function todoTriggerAt(view: EditorView, pos: number): number | null {
  const line = view.state.doc.lineAt(pos)
  const before = view.state.sliceDoc(line.from, pos)
  if (!before.endsWith(TRIGGER)) return null
  const lead = before.slice(0, -TRIGGER.length)
  if (lead !== '' && !/\s$/.test(lead)) return null
  for (
    let node: SyntaxNode | null = treeTo(view.state, pos).resolveInner(pos, -1);
    node;
    node = node.parent
  )
    if (NOT_A_PLACE_FOR_A_TODO.has(node.name)) return null
  return pos - TRIGGER.length
}

/** Whether this update is one letter typed at a cursor (not a paste, not a replaced selection); returns where the cursor is. */
function typedLetter(update: ViewUpdate): number | null {
  if (!update.transactions.some((tr) => tr.isUserEvent('input.type'))) return null
  let count = 0
  let cursor: number | null = null
  update.changes.iterChanges((fromA, toA, _fromB, toB, inserted) => {
    count += 1
    if (fromA === toA && inserted.length === 1) cursor = toB
  })
  return count === 1 ? cursor : null
}

/** The TODO helper for a live editor, talking to the menu through `bridge`. */
export function liveTodoHelper(bridge: TodoMenuBridge): Extension {
  const openAt = (view: EditorView, from: number, to: number): void => {
    bridge.open({
      from,
      to,
      at: view.coordsAtPos(from) ?? { left: 0, bottom: 0 },
      insert: (owner) => insertTodoText(view, from, to, owner)
    })
  }
  return [
    ViewPlugin.fromClass(
      class {
        update(update: ViewUpdate): void {
          // Typing or moving the cursor elsewhere closes the menu (choosing has closed it already, before it writes).
          if (bridge.isOpen() && (update.docChanged || update.selectionSet)) bridge.close()
          const cursor = update.docChanged ? typedLetter(update) : null
          if (cursor === null) return
          const from = todoTriggerAt(update.view, cursor)
          if (from === null) return
          // The menu goes where the text is on screen, which cannot be read in the middle of an update.
          update.view.requestMeasure({
            key: this,
            read: (view) => view.coordsAtPos(from),
            write: (at, view) => {
              // Typed on since: the `/todo` is no longer there, or the cursor has left it.
              const head = view.state.selection.main
              if (!head.empty || head.head !== cursor || todoTriggerAt(view, cursor) !== from)
                return
              bridge.open({
                from,
                to: cursor,
                at: at ?? { left: 0, bottom: 0 },
                insert: (owner) => insertTodoText(view, from, cursor, owner)
              })
            }
          })
        }
        destroy(): void {
          bridge.close()
        }
      }
    ),
    Prec.highest(
      EditorView.domEventHandlers({
        keydown(event, view) {
          if (bridge.isOpen()) {
            const key = KEYS[event.key]
            if (key && bridge.key(key)) {
              event.preventDefault()
              return true
            }
            if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
              event.preventDefault()
              bridge.type(event.key)
              return true
            }
            if (event.key === 'Backspace') {
              if (bridge.backspace()) {
                event.preventDefault()
                return true
              }
              bridge.close()
            }
            return false
          }
          if (!matchesShortcut(event, TODO_SHORTCUT)) return false
          event.preventDefault()
          const { from, to } = view.state.selection.main
          openAt(view, from, to)
          return true
        }
      })
    )
  ]
}
