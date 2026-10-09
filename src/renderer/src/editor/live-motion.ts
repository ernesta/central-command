import {
  cursorLineBoundaryBackward,
  cursorLineBoundaryLeft,
  cursorLineStart,
  defaultKeymap,
  selectLineBoundaryBackward,
  selectLineBoundaryLeft,
  selectLineStart
} from '@codemirror/commands'
import { EditorSelection } from '@codemirror/state'
import type { Command, EditorView, KeyBinding } from '@codemirror/view'
import { liveDecorations } from './live-decorations'
import { listMarkAt, parseLine } from './live-lines'

/*
 * Cursor motion that must not stop inside a drawn bullet, number or checkbox. Arrow keys and clicks already skip them
 * (`atomicRanges`), but Home and Cmd-Left go to the first character that is not white space, and for an indented item
 * that is inside the marker. After such a motion the cursor is moved to the end of the marker, the start of the text.
 */

const LINE_START_COMMANDS = new Set<Command>([
  cursorLineBoundaryBackward,
  cursorLineBoundaryLeft,
  cursorLineStart,
  selectLineBoundaryBackward,
  selectLineBoundaryLeft,
  selectLineStart
])

const SELECTING = new Set<Command>([
  selectLineBoundaryBackward,
  selectLineBoundaryLeft,
  selectLineStart
])

/**
 * In a list item, a line-start motion goes in two steps: first to the start of the text (after the bullet, number or
 * checkbox), then, from there, to the start of the line, so Cmd-Shift-Left selects the text first and the whole item
 * on a second press. Only on the item's first visual row; a wrapped row keeps the default (its own start).
 */
function listStep(view: EditorView, extend: boolean): boolean {
  const { state } = view
  let changed = false
  const ranges = state.selection.ranges.map((range) => {
    const line = state.doc.lineAt(range.head)
    const parts = parseLine(line.text)
    if (!listMarkAt(state, line.from, parts)) return range
    const textStart = line.from + parts.quote.length + parts.indent.length + parts.marker.length
    if (range.head < textStart) return range
    if (view.moveToLineBoundary(EditorSelection.cursor(range.head), false).head > textStart)
      return range
    const head = range.head > textStart ? textStart : line.from
    changed = true
    return extend ? EditorSelection.range(range.anchor, head) : EditorSelection.cursor(head)
  })
  if (!changed) return false
  view.dispatch({
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    scrollIntoView: true,
    userEvent: 'select'
  })
  return true
}

function outOfMarkers(command: Command): Command {
  return (view) => {
    if (listStep(view, SELECTING.has(command))) return true
    if (!command(view)) return false
    const atomic = view.plugin(liveDecorations)?.atomic
    if (!atomic) return true
    const snap = (pos: number): number => {
      let at = pos
      atomic.between(pos, pos, (from, to) => {
        if (from < pos && pos < to) at = to
      })
      return at
    }
    const ranges = view.state.selection.ranges.map((range) => {
      const head = snap(range.head)
      if (head === range.head) return range
      return range.empty ? EditorSelection.cursor(head) : EditorSelection.range(range.anchor, head)
    })
    if (ranges.some((range, i) => range !== view.state.selection.ranges[i]))
      view.dispatch({
        selection: EditorSelection.create(ranges, view.state.selection.mainIndex),
        scrollIntoView: true
      })
    return true
  }
}

/** The default keymap, with the line-start motions made to keep out of markers. */
export const motionKeymap: readonly KeyBinding[] = defaultKeymap.map((binding) =>
  (binding.run && LINE_START_COMMANDS.has(binding.run)) ||
  (binding.shift && LINE_START_COMMANDS.has(binding.shift))
    ? {
        ...binding,
        run: binding.run && outOfMarkers(binding.run),
        shift: binding.shift && outOfMarkers(binding.shift)
      }
    : binding
)
