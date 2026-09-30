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
  const state = base.update({ selection: EditorSelection.single(anchor, head) }).state
  ensureSyntaxTree(state, state.doc.length, 10_000)
  return state
}

export interface Seen {
  from: number
  to: number
  /** The class, or `hidden` for a replaced (hidden) range. */
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
    seen.push({ from, to, kind: value.point && !spec.class ? 'hidden' : (spec.class ?? '') })
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
