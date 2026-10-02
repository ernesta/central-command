import { Facet, StateEffect, StateField, type Extension, type Text } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type Command
} from '@codemirror/view'
import { noFindBridge, type FindBridge, type FindMatch, type FindTarget } from '../notes/find-types'

/*
 * Find and replace in the live editor. The document is the Markdown text, so find reads that text: a word inside
 * `**bold**` is found, and so is a marker (a query of only `*` or `#` matches markers, and a word in the address of
 * a link or of a mention's chip matches although the address is hidden). The bar itself is the shared one
 * (`useNotesFind`, `NotesFindBar`); this file is the editor's side of it, the same shape as `liveTarget` for `@`.
 */

/**
 * Lower case that keeps every character's length (`İ` would become two code units, which would move every position
 * after it), so a position in the folded text is a position in the document.
 */
function fold(text: string): string {
  const lower = text.toLowerCase()
  if (lower.length === text.length) return lower
  let out = ''
  for (const char of text) {
    const folded = char.toLowerCase()
    out += folded.length === char.length ? folded : char
  }
  return out
}

/**
 * Every case-insensitive match of `query` (its white space at the ends ignored, as before) in `doc`, in document
 * order. Matches never overlap (`aa` in `aaa` is one match), which is what makes replace-all a set of separate edits,
 * and never cross a line break, since a query is one line.
 */
export function findInDoc(doc: Text, query: string): FindMatch[] {
  const q = fold(query.trim())
  if (!q) return []
  const matches: FindMatch[] = []
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    const text = fold(line.text)
    for (let at = text.indexOf(q); at !== -1; at = text.indexOf(q, at + q.length))
      matches.push({ from: line.from + at, to: line.from + at + q.length })
  }
  return matches
}

interface Highlight {
  matches: readonly FindMatch[]
  active: number
  decorations: DecorationSet
}

const highlightOf = (matches: readonly FindMatch[], active: number): Highlight => ({
  matches,
  active,
  decorations: Decoration.set(
    matches.map((m, i) =>
      Decoration.mark({ class: i === active ? 'notes-find-active' : 'notes-find-match' }).range(
        m.from,
        m.to
      )
    ),
    true
  )
})

const setHighlight = StateEffect.define<{ matches: readonly FindMatch[]; active: number }>()

/** The matches drawn now. They follow the text when it changes (typing in the note while the bar is open). */
const highlightField = StateField.define<Highlight>({
  create: () => highlightOf([], 0),
  update(value, tr) {
    for (const effect of tr.effects)
      if (effect.is(setHighlight)) return highlightOf(effect.value.matches, effect.value.active)
    if (!tr.docChanged || value.matches.length === 0) return value
    const matches = value.matches
      .map((m) => ({ from: tr.changes.mapPos(m.from, 1), to: tr.changes.mapPos(m.to, -1) }))
      .filter((m) => m.from < m.to)
    return highlightOf(matches, Math.min(value.active, Math.max(matches.length - 1, 0)))
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations)
})

/** Where this editor's Cmd-F reaches the bar (`useNotesFind`). */
const findBridgeFacet = Facet.define<FindBridge, FindBridge>({
  combine: (bridges) => bridges[0] ?? noFindBridge
})

/** The find bar's view of a live editor. */
export function liveFindTarget(view: EditorView): FindTarget {
  const inDoc = (m: FindMatch): boolean =>
    m.from >= 0 && m.from < m.to && m.to <= view.state.doc.length
  return {
    search: (query) => findInDoc(view.state.doc, query),
    highlight: (matches, active) =>
      view.dispatch({ effects: setHighlight.of({ matches, active }) }),
    scrollTo: (match) => {
      if (match && inDoc(match))
        view.dispatch({ effects: EditorView.scrollIntoView(match.from, { y: 'center' }) })
    },
    // `input.replace` is not typing or deleting, so the history never joins two replacements: each is its own undo step.
    replace: (match, replacement) => {
      if (!inDoc(match)) return
      view.dispatch({
        changes: { from: match.from, to: match.to, insert: replacement },
        userEvent: 'input.replace'
      })
    },
    // One transaction: one undo step, and every position is read against the text as it was.
    replaceAll: (matches, replacement) => {
      const found = matches.filter(inDoc)
      if (found.length === 0) return
      view.dispatch({
        changes: found.map((m) => ({ from: m.from, to: m.to, insert: replacement })),
        userEvent: 'input.replace'
      })
    }
  }
}

/** Cmd-F, or Cmd-Option-F with the replace row shown. While the bar is already open, it takes the cursor back to its find field. */
export const openFind =
  (showReplace: boolean): Command =>
  (view) => {
    const bridge = view.state.facet(findBridgeFacet)
    if (bridge.isOpen()) {
      bridge.focus()
      return true
    }
    bridge.open(liveFindTarget(view), showReplace)
    return bridge !== noFindBridge
  }

/** Cmd-Enter, Cmd-Shift-Enter while the note has focus and the bar is open with its replace row: replace this match, or all. */
export const replaceFromKey =
  (all: boolean): Command =>
  (view) =>
    view.state.facet(findBridgeFacet).replaceFromEditor(all)

/** Everything find needs beyond the keys (`live-keymap.ts`): the highlights, the bridge, and telling the bar when the editor goes. */
export function findExtension(bridge: FindBridge | undefined): Extension[] {
  return [
    highlightField,
    findBridgeFacet.of(bridge ?? noFindBridge),
    // A click in the note, or Escape in it, closes the bar (clicking the bar itself is outside the editor).
    EditorView.domEventHandlers({
      mousedown: (_event, view) => {
        view.state.facet(findBridgeFacet).close()
      },
      keydown: (event, view) => {
        const bridge = view.state.facet(findBridgeFacet)
        if (event.key !== 'Escape' || !bridge.isOpen()) return false
        bridge.close()
        return true
      }
    }),
    // The bar (and the React state behind it) can outlive this one view: a reload from disk, or React StrictMode's
    // throwaway first mount, destroys the view without going through the bar's own Close.
    ViewPlugin.fromClass(
      class {
        constructor(readonly view: EditorView) {}
        destroy(): void {
          this.view.state.facet(findBridgeFacet).detach()
        }
      }
    )
  ]
}
