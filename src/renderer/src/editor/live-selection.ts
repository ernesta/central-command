import {
  EditorSelection,
  EditorState,
  type Extension,
  type TransactionSpec
} from '@codemirror/state'
import { layer, RectangleMarker, type LayerMarker } from '@codemirror/view'

/**
 * What a line starts with before its text: an optional quote or list prefix (never snapped to, it is drawn as its own
 * thing), then the hidden markers of a heading or of spans that open at the text's first character.
 */
const LEADING_MARKERS =
  /^([ \t]*(?:>[ \t]*)*(?:(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?)((?:#{1,6}[ \t]+|\*\*|__|~~|[*_`])+)/

/**
 * A selection that reaches into the next line from above ends at that line's text, which is where the pointer is
 * when it sits at the line's edge; the hidden `## ` of a heading or `**` / `*` that open the line lie before that
 * point, so deleting took them too. Such a selection now ends at the start of the line. Only when the selection
 * starts on an earlier line: one that starts inside the line's own text is meant to begin there.
 */
export const snapSelectionToLineStart = EditorState.transactionFilter.of(
  (tr): TransactionSpec[] => {
    if (!tr.selection || tr.docChanged) return [tr]
    let changed = false
    const ranges = tr.selection.ranges.map((range) => {
      if (range.empty) return range
      const to = range.to
      const line = tr.newDoc.lineAt(to)
      if (range.from >= line.from) return range
      const marker = LEADING_MARKERS.exec(line.text)
      if (!marker) return range
      const textStart = line.from + marker[1].length
      if (to < textStart || to > textStart + marker[2].length) return range
      changed = true
      return range.anchor < range.head
        ? EditorSelection.range(range.anchor, line.from)
        : EditorSelection.range(line.from, range.head)
    })
    if (!changed) return [tr]
    return [
      tr,
      { selection: EditorSelection.create(ranges, tr.selection.mainIndex), sequential: false }
    ]
  }
)

/**
 * The selection, drawn as one block. CodeMirror's own drawing starts the bands of a note at the first line's
 * padding (a quote or an item pushes every band in) and runs a selection that ends at the start of a line down
 * through the gap above that line's text. This draws the same rectangles from the content's edge, and a selection
 * that ends at the start of a line stops at the end of the line before. The default layer is hidden in the CSS.
 */
const selectionLayer = layer({
  above: false,
  class: 'live-selectionLayer',
  markers(view) {
    const content = view.contentDOM.getBoundingClientRect()
    const firstLine = view.contentDOM.querySelector('.cm-line')
    const style = firstLine && window.getComputedStyle(firstLine)
    const defaultLeft =
      content.left +
      (style ? parseInt(style.paddingLeft) + Math.min(0, parseInt(style.textIndent)) : 0)
    const scroller = view.scrollDOM.getBoundingClientRect()
    const base = {
      left: scroller.left - view.scrollDOM.scrollLeft,
      top: scroller.top - view.scrollDOM.scrollTop
    }
    const markers: LayerMarker[] = []
    for (const range of view.state.selection.ranges) {
      if (range.empty) continue
      let to = range.to
      if (view.state.doc.lineAt(to).from === to && to - 1 > range.from) to -= 1
      for (const marker of RectangleMarker.forRange(
        view,
        'cm-selectionBackground',
        EditorSelection.range(range.from, to)
      )) {
        const shift = marker.left + base.left - defaultLeft
        markers.push(
          Math.abs(shift) < 0.5 && marker.width !== null
            ? new RectangleMarker(
                'cm-selectionBackground',
                content.left - base.left,
                marker.top,
                marker.width + (defaultLeft - content.left),
                marker.height
              )
            : marker
        )
      }
    }
    // The pieces meet at fractional heights: let each run a pixel into the next, or a hairline shows between them.
    return markers.map((marker, i) =>
      marker instanceof RectangleMarker && marker.width !== null && i < markers.length - 1
        ? new RectangleMarker(
            'cm-selectionBackground',
            marker.left,
            marker.top,
            marker.width,
            marker.height + 1
          )
        : marker
    )
  },
  update: (update) =>
    update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged
})

export const liveSelection: Extension = [snapSelectionToLineStart, selectionLayer]
