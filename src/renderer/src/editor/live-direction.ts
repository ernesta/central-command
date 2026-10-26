import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Extension, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { textDirection } from '@shared/text-direction'

/*
 * Every line has the direction of its own first strong letter, like `dir="auto"`: an Arabic or Urdu paragraph runs from
 * the right, a line that opens in English runs from the left, in the same note. CodeMirror reads the direction the
 * browser assigns (`perLineTextDirection`) for the caret, arrows, Home/End and the selection, so it is set as the
 * `dir` attribute rather than left to `unicode-bidi`, which would not change the computed direction. A table is one
 * unit: all its rows take the direction of its header row, or the columns would run opposite ways row to row; the
 * text of each cell is `dir="auto"` itself (`live-tables.ts`). Lines with no letter yet (a blank one) stay left to right.
 */

const lines = {
  ltr: Decoration.line({ attributes: { dir: 'ltr' } }),
  rtl: Decoration.line({ attributes: { dir: 'rtl' } })
}

type Direction = 'ltr' | 'rtl'

/** The direction of each line (by its start) in the ranges: its own first strong letter, or its table's. */
export function lineDirections(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): Map<number, Direction> {
  const doc = state.doc
  const inTable = new Map<number, Direction>()
  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Table') return
        const first = doc.lineAt(node.from)
        const dir = textDirection(first.text) ?? 'ltr'
        for (let n = first.number; n <= doc.lineAt(node.to).number; n++) inTable.set(n, dir)
        return false
      }
    })
  }
  const found = new Map<number, Direction>()
  for (const { from, to } of ranges) {
    for (let pos = from; pos <= to;) {
      const line = doc.lineAt(pos)
      pos = line.to + 1
      found.set(line.from, inTable.get(line.number) ?? textDirection(line.text) ?? 'ltr')
    }
  }
  return found
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const found = lineDirections(view.state, view.visibleRanges)
  for (const from of [...found.keys()].sort((a, b) => a - b))
    builder.add(from, from, lines[found.get(from)!])
  return builder.finish()
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      )
        this.decorations = build(update.view)
    }
  },
  { decorations: (value) => value.decorations }
)

export const liveDirection: Extension = [EditorView.perLineTextDirection.of(true), plugin]
