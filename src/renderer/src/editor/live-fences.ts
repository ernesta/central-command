import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { Extent } from './live-reveal'

/*
 * Fenced code. The fence lines (the backticks or tildes, and the language after the opening one) are real text: they show
 * in the marker colour while the cursor is anywhere in the block, and are hidden otherwise (the empty line keeps its
 * height, so the block does not move when the cursor enters it). Nothing is edited here. A fence that is never closed keeps its opening line showing, because
 * everything below it is code and the note would look broken without the reason.
 */

const hidden = Decoration.replace({})
const marker = Decoration.mark({ class: 'live-marker' })

type Add = (kind: string, from: number, to: number, deco: Decoration) => void

export function drawFence(
  state: EditorState,
  node: SyntaxNode,
  revealed: boolean,
  range: Extent,
  add: Add
): void {
  const doc = state.doc
  const marks = node.getChildren('CodeMark')
  const closed = marks.length >= 2
  const showing = revealed || !closed
  const fenceLines = new Set<number>()
  for (const mark of marks) fenceLines.add(doc.lineAt(mark.from).from)

  for (let pos = Math.max(node.from, range.from); pos <= Math.min(node.to, range.to);) {
    const line = doc.lineAt(pos)
    const fence = fenceLines.has(line.from)
    add(
      'line-code',
      line.from,
      line.from,
      Decoration.line({
        class: fence && !showing ? 'live-codeblock live-fence-hidden' : 'live-codeblock'
      })
    )
    pos = line.to + 1
  }
  for (const mark of marks) {
    const line = doc.lineAt(mark.from)
    if (showing) {
      add('marker', mark.from, line.to, marker)
    } else if (mark.from < line.to) add('marker', mark.from, line.to, hidden)
  }
}
