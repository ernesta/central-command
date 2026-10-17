import { type EditorState, type Extension, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import { parseLine } from './live-lines'

/*
 * The caret on an empty list item, task or quote line. With no text on the line CodeMirror sizes the caret from the whole line
 * (a bullet's was 29px tall against 21px for typed text, so it grew and moved at the first letter). A zero-width space in the line's
 * own font gives it the text's box instead. It is a widget at the caret only, never in the document, and not an atomic range.
 */

class CaretAnchor extends WidgetType {
  eq(): boolean {
    return true
  }
  toDOM(): HTMLElement {
    const dom = document.createElement('span')
    dom.className = 'live-caret-anchor'
    dom.setAttribute('aria-hidden', 'true')
    dom.textContent = '​'
    return dom
  }
  ignoreEvent(): boolean {
    return true
  }
}

const anchor = Decoration.widget({ widget: new CaretAnchor(), side: -1 })

function anchorFor(state: EditorState): DecorationSet {
  const range = state.selection.main
  if (!range.empty) return Decoration.none
  const line = state.doc.lineAt(range.head)
  if (range.head !== line.to || line.length === 0) return Decoration.none
  const parts = parseLine(line.text)
  const empty = parts.content === '' && (parts.kind !== 'none' || parts.quote !== '')
  if (!empty || parts.kind === 'heading') return Decoration.none
  return Decoration.set([anchor.range(range.head)])
}

const field = StateField.define<DecorationSet>({
  create: anchorFor,
  update: (_value, tr) => anchorFor(tr.state),
  provide: (f) => EditorView.decorations.from(f)
})

export const liveCaret: Extension = field
