import {
  EditorSelection,
  EditorState,
  type Extension,
  type TransactionSpec
} from '@codemirror/state'
import {
  Direction,
  layer,
  RectangleMarker,
  type EditorView,
  type LayerMarker
} from '@codemirror/view'

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

interface TableRow {
  from: number
  to: number
  el: HTMLElement
}

/** The rows of every grid table drawn in the view, in document order. */
function tableRows(view: EditorView): TableRow[] {
  const rows: TableRow[] = []
  for (const el of view.contentDOM.querySelectorAll<HTMLElement>('.cm-line.live-table-row')) {
    const line = view.state.doc.lineAt(view.posAtDOM(el))
    rows.push({ from: line.from, to: line.to, el })
  }
  return rows
}

/**
 * The selected part of one grid row: the whole row's box when all of it is selected, otherwise the selected text of
 * each cell, one band per wrapped line, as tall as the row's line height.
 */
function rowMarkers(
  view: EditorView,
  row: TableRow,
  from: number,
  to: number,
  base: { left: number; top: number }
): LayerMarker[] {
  const box = row.el.getBoundingClientRect()
  if (from <= row.from && to >= row.to) {
    return [
      new RectangleMarker(
        'cm-selectionBackground',
        box.left - base.left,
        box.top - base.top,
        box.width,
        box.height
      )
    ]
  }
  const lineHeight = parseFloat(window.getComputedStyle(row.el).lineHeight) || box.height
  const markers: LayerMarker[] = []
  const walker = document.createTreeWalker(row.el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0
    if (!length || node.parentElement?.closest('[contenteditable="false"]')) continue
    const start = view.posAtDOM(node, 0)
    const lo = Math.max(from, start)
    const hi = Math.min(to, start + length)
    if (lo >= hi) continue
    const piece = document.createRange()
    piece.setStart(node, lo - start)
    piece.setEnd(node, hi - start)
    for (const rect of piece.getClientRects()) {
      if (rect.width <= 0) continue
      markers.push(
        new RectangleMarker(
          'cm-selectionBackground',
          rect.left - base.left,
          rect.top + rect.height / 2 - lineHeight / 2 - base.top,
          rect.width,
          lineHeight
        )
      )
    }
  }
  return markers
}

/**
 * CodeMirror runs a band to the edge of the line from the *editor's* direction (`view.textDirection`), so a right-to-left
 * line in a left-to-right note (`live-direction.ts`) gets bands that stop at the text on both sides. A selection that
 * continues past such a line's end (its left side) or comes into it from above (its right side) gets the missing piece.
 */
function rtlEdges(
  view: EditorView,
  range: { from: number; to: number },
  skip: readonly TableRow[],
  base: { left: number; top: number }
): LayerMarker[] {
  const markers: LayerMarker[] = []
  const content = view.contentDOM.getBoundingClientRect()
  const { doc } = view.state
  const from = Math.max(range.from, view.viewport.from)
  const to = Math.min(range.to, view.viewport.to)
  for (let pos = from; pos <= to;) {
    const line = doc.lineAt(pos)
    pos = line.to + 1
    if (skip.some((row) => row.from === line.from)) continue
    if (view.textDirectionAt(line.from) !== Direction.RTL) continue
    const edge = (at: number, side: -1 | 1, toRight: boolean): void => {
      const coords = view.coordsAtPos(at, side)
      if (!coords) return
      const left = toRight ? coords.right : content.left
      const right = toRight ? content.right : coords.left
      if (right - left < 0.5) return
      markers.push(
        new RectangleMarker(
          'cm-selectionBackground',
          left - base.left,
          coords.top - base.top,
          right - left,
          coords.bottom - coords.top
        )
      )
    }
    if (range.to > line.to && range.from <= line.to) edge(line.to, -1, false)
    if (range.from < line.from && range.to > line.from) edge(line.from, 1, true)
  }
  return markers
}

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
    const rows = tableRows(view)
    const place = (from: number, to: number): void => {
      for (const marker of RectangleMarker.forRange(
        view,
        'cm-selectionBackground',
        EditorSelection.range(from, to)
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
    for (const range of view.state.selection.ranges) {
      if (range.empty) continue
      let to = range.to
      if (view.state.doc.lineAt(to).from === to && to - 1 > range.from) to -= 1
      // A row of a grid is one line of the text but several lines on the screen, each cell wrapping on its own: the
      // text-line bands CodeMirror draws would run through the cells, so a row's selection is drawn cell by cell.
      let at = range.from
      for (const row of rows) {
        if (row.to < at || row.from > to) continue
        if (at < row.from) place(at, row.from - 1)
        const from = Math.max(at, row.from)
        const end = Math.min(to, row.to)
        if (from < end || (from === end && range.from <= row.from && to > row.to)) {
          markers.push(...rowMarkers(view, row, from, end, base))
        }
        at = row.to + 1
      }
      if (at < to) place(at, to)
      markers.push(...rtlEdges(view, range, rows, base))
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
