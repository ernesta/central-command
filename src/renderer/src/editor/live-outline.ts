import type { EditorState } from '@codemirror/state'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/*
 * Sending the live editor somewhere: the outline (`NoteOutline`) and Meetings' topics panel click a heading and the note scrolls
 * to it. The editor only draws the lines near the screen, so a heading far away has no element to scroll to: this goes through
 * the view (`scrollIntoView`) instead of the page.
 */

/** The live editor inside `root`, or null (nothing there). */
export function liveViewIn(root: Element | null): EditorView | null {
  const dom = root?.querySelector<HTMLElement>('.cm-editor')
  return dom ? EditorView.findFromDOM(dom) : null
}

/**
 * Where heading number `line` (from 0, as `locatedOutline` counts) starts, or null when that line is not a heading now:
 * the outline is made from the text as of the last change, and a click a moment later must not land somewhere else.
 */
export function headingStart(state: EditorState, line: number): number | null {
  if (line < 0 || line >= state.doc.lines) return null
  const at = state.doc.line(line + 1)
  return /^#{1,6}\s/.test(at.text) ? at.from : null
}

/** Scroll `pos` to the top of the window, leaving the cursor where it is. */
export function scrollToPos(view: EditorView, pos: number): void {
  view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 8 }) })
}

/** Scroll `pos` into view and put the cursor at the end of its line, in the editor (a topic clicked in the side panel). */
export function placeCursorOnLine(view: EditorView, pos: number): void {
  const end = view.state.doc.lineAt(Math.min(Math.max(pos, 0), view.state.doc.length)).to
  view.dispatch({
    selection: EditorSelection.cursor(end),
    effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 8 })
  })
  view.focus()
}
