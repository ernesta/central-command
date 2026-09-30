import { ensureSyntaxTree } from '@codemirror/language'
import { EditorSelection, type Extension } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import type { LiveEntities } from './live-entities'
import type { FindBridge } from '../notes/find-types'
import { createLiveState } from './live-state'

/*
 * For tests that press keys in a real `EditorView` (they declare `// @vitest-environment jsdom`). Text is written with
 * `|` for the cursor, or two of them round a selection (`a |b| c`); `show` writes the state back the same way.
 */

// jsdom cannot measure text; CodeMirror only asks when it draws.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()

export interface Opened {
  view: EditorView
  /** Every text `onChange` was given, in order. */
  reports: string[]
}

export function openView(
  marked: string,
  entities?: LiveEntities,
  more: { find?: FindBridge; extensions?: readonly Extension[] } = {}
): Opened {
  const first = marked.indexOf('|')
  const second = first < 0 ? -1 : marked.indexOf('|', first + 1)
  const doc = marked.replace(/\|/g, '')
  const reports: string[] = []
  const view = new EditorView({
    parent: document.body.appendChild(document.createElement('div')),
    state: createLiveState({
      doc,
      label: 'test',
      onChange: (text) => reports.push(text),
      openLink: () => undefined,
      entities,
      ...more
    })
  })
  if (first >= 0)
    view.dispatch({
      selection: EditorSelection.single(first, second < 0 ? first : second - 1)
    })
  ensureSyntaxTree(view.state, view.state.doc.length, 10_000)
  return { view, reports }
}

/** The document with the selection written in (`|` for a cursor, two round a selection). */
export function show(view: EditorView): string {
  const { anchor, head } = view.state.selection.main
  const text = view.state.sliceDoc()
  const from = Math.min(anchor, head)
  const to = Math.max(anchor, head)
  return from === to
    ? `${text.slice(0, from)}|${text.slice(from)}`
    : `${text.slice(0, from)}|${text.slice(from, to)}|${text.slice(to)}`
}

const KEY_CODES: Record<string, number> = {
  Enter: 13,
  Tab: 9,
  Backspace: 8,
  Delete: 46,
  '[': 219,
  ']': 221
}

/**
 * Press a chord such as `Mod-Alt-1` or `Shift-Tab` through the editor's own keymaps, the way a keydown reaches them.
 * (`Mod` is Ctrl here: jsdom is not a Mac, and the keymaps read the platform the same way.) Returns whether a
 * binding handled it.
 */
export function press(view: EditorView, chord: string): boolean {
  const parts = chord.split('-')
  const key = parts.pop() as string
  const has = (name: string): boolean => parts.includes(name)
  const event = new KeyboardEvent('keydown', {
    // With Shift held a letter arrives as a capital, as in a real keydown.
    key: has('Shift') && key.length === 1 ? key.toUpperCase() : key,
    keyCode: KEY_CODES[key] ?? key.toUpperCase().charCodeAt(0),
    ctrlKey: has('Mod') || has('Ctrl'),
    altKey: has('Alt'),
    shiftKey: has('Shift'),
    metaKey: has('Meta'),
    bubbles: true,
    cancelable: true
  })
  return runScopeHandlers(view, event, 'editor')
}
