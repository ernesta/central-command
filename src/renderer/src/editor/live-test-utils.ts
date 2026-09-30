import { ensureSyntaxTree } from '@codemirror/language'
import { EditorSelection, type EditorState } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { buildDecorations } from './live-decorations'
import { computeReveal } from './live-reveal'
import { createLiveState } from './live-state'

/** A state with the whole document parsed (a state parses lazily, and a test wants the full tree). */
export function stateFor(doc: string, anchor = 0, head = anchor): EditorState {
  const base = createLiveState({
    doc,
    label: 'test',
    onChange: () => undefined,
    openLink: () => undefined
  })
  // A state starts with the tree of the first few thousand characters only, and `syntaxTree(state)` keeps returning that
  // one however far `ensureSyntaxTree` parses afterwards: the next transaction is what picks the finished tree up. (The
  // running editor gets there as the parser works in idle time; a test has to do it here, or it sees a long note's tail
  // as plain text.)
  ensureSyntaxTree(base, base.doc.length, 10_000)
  return base.update({ selection: EditorSelection.single(anchor, head) }).state
}

export interface Seen {
  from: number
  to: number
  /** The class, `hidden` for a replaced (hidden) range, or `widget` for a range drawn as a bullet, number or checkbox. */
  kind: string
}

/** Every decoration for the whole document as plain data, with the editor focused. */
export function decorationsOf(state: EditorState, focused = true): Seen[] {
  const set: DecorationSet = buildDecorations(state, computeReveal(state, focused), [
    { from: 0, to: state.doc.length }
  ])
  const seen: Seen[] = []
  set.between(0, state.doc.length, (from, to, value) => {
    const spec = value.spec as { class?: string }
    const kind = value.spec.widget
      ? 'widget'
      : value.point && !spec.class
        ? 'hidden'
        : (spec.class ?? '')
    seen.push({ from, to, kind })
  })
  return seen
}

/** The text hidden by replace decorations, in order. */
export function hiddenText(state: EditorState, focused = true): string[] {
  return decorationsOf(state, focused)
    .filter((seen) => seen.kind === 'hidden')
    .map((seen) => state.doc.sliceString(seen.from, seen.to))
}

/** The text drawn in the marker colour (markers that are showing), in order. */
export function shownMarkers(state: EditorState, focused = true): string[] {
  return decorationsOf(state, focused)
    .filter((seen) => seen.kind === 'live-marker')
    .map((seen) => state.doc.sliceString(seen.from, seen.to))
}
