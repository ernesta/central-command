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
import type { Command, KeyBinding } from '@codemirror/view'
import { liveDecorations } from './live-decorations'

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

function outOfMarkers(command: Command): Command {
  return (view) => {
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
