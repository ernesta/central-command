import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

export interface Extent {
  from: number
  to: number
}

/** The blocks that hold text directly (not the containers around them: quotes, list items, the document). */
const LEAF_BLOCKS = new Set([
  'Paragraph',
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
  'SetextHeading1',
  'SetextHeading2',
  'HorizontalRule',
  'FencedCode',
  'CodeBlock',
  'Table',
  'HTMLBlock',
  'CommentBlock',
  'ProcessingInstructionBlock',
  'LinkReference'
])

/**
 * The leaf block on the line of `pos`, widened to whole lines; just the line when it holds no block (a blank line,
 * a `>` on its own). A block's markers show while the cursor is anywhere in these lines.
 */
export function blockExtentAt(state: EditorState, pos: number): Extent {
  const line = state.doc.lineAt(pos)
  const found: { block: Extent | null } = { block: null }
  syntaxTree(state).iterate({
    from: line.from,
    to: line.to,
    enter(node) {
      if (found.block) return false
      if (!LEAF_BLOCKS.has(node.name)) return
      if (node.from > line.to || node.to < line.from) return false
      found.block = { from: node.from, to: node.to }
      return false
    }
  })
  const block = found.block
  if (!block) return { from: line.from, to: line.to }
  return { from: state.doc.lineAt(block.from).from, to: state.doc.lineAt(block.to).to }
}

/** What the selection says to show. Pure data, so the rules can be tested without a view. */
export interface Reveal {
  /** Nothing is shown at all: the editor is not focused, or the selection reaches across blocks. */
  none: boolean
  /** The selection ranges themselves; a span's markers show when one touches it. */
  ranges: readonly Extent[]
  /** The whole-line extents of the blocks the selection is in; a block's markers show when one covers them. */
  blocks: readonly Extent[]
}

export const REVEAL_NOTHING: Reveal = { none: true, ranges: [], blocks: [] }

/**
 * Work out what to reveal for the current selection. Only while the editor has focus (otherwise a note opens with
 * the first heading's `#` showing). A selection that starts in one block and ends in another shows no markers
 * anywhere; copying it still gives the Markdown, because the markers are real characters.
 */
export function computeReveal(state: EditorState, focused: boolean): Reveal {
  if (!focused) return REVEAL_NOTHING
  const ranges: Extent[] = []
  const blocks: Extent[] = []
  for (const range of state.selection.ranges) {
    let block = blockExtentAt(state, range.head)
    if (!range.empty) {
      // A selection that ends at the start of a line (a triple-click takes the newline too) ends in the line before.
      const end = state.doc.lineAt(range.to).from === range.to ? range.to - 1 : range.to
      block = blockExtentAt(state, range.from)
      const last = blockExtentAt(state, Math.max(range.from, end))
      if (block.from !== last.from || block.to !== last.to) return REVEAL_NOTHING
    }
    ranges.push({ from: range.from, to: range.to })
    blocks.push(block)
  }
  return { none: false, ranges, blocks }
}

/** A span's markers show when a selection range touches it (the cursor at either edge counts). */
export function spanRevealed(reveal: Reveal, from: number, to: number): boolean {
  return reveal.ranges.some((range) => range.from <= to && range.to >= from)
}

/** A block's markers show when the cursor is in the block's lines. */
export function blockRevealed(reveal: Reveal, from: number, to: number): boolean {
  return reveal.blocks.some((block) => block.from <= to && block.to >= from)
}
