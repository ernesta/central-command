import { WidgetType, type EditorView } from '@codemirror/view'
import { parseLine } from './live-lines'

/*
 * What stands in for a list item's marker while it is drawn: a bullet, a number, or a checkbox. Each replaces the
 * whole prefix (`  - `, `2. `, `- [x] `) and is atomic, so the cursor never lands inside it and Backspace after it
 * is decided by `live-lists.ts`, not by which character happens to be last.
 */

/** The box at the start of a numbered item's text. */
export const ORDERED_BOX = /^\[([ xX])\] /

export class BulletWidget extends WidgetType {
  eq(): boolean {
    return true
  }
  toDOM(): HTMLElement {
    const dom = document.createElement('span')
    dom.className = 'live-bullet'
    dom.setAttribute('aria-hidden', 'true')
    dom.textContent = '•'
    return dom
  }
}

export class NumberWidget extends WidgetType {
  constructor(readonly label: string) {
    super()
  }
  eq(other: NumberWidget): boolean {
    return other.label === this.label
  }
  toDOM(): HTMLElement {
    const dom = document.createElement('span')
    dom.className = 'live-number'
    dom.setAttribute('aria-hidden', 'true')
    dom.textContent = this.label
    return dom
  }
}

/** Flip `[ ]` and `[x]` on the line that holds `pos` (the start of the drawn prefix). Returns whether it did. */
export function toggleTaskAt(view: EditorView, pos: number): boolean {
  const line = view.state.doc.lineAt(pos)
  const parts = parseLine(line.text)
  const prefix = line.from + parts.quote.length + parts.indent.length
  // A numbered item may carry a box too (`2. [ ] text`): the box sits after the number.
  const ordered = parts.kind === 'ordered' ? ORDERED_BOX.exec(parts.content) : null
  if (parts.kind !== 'task' && !ordered) return false
  const checked = ordered ? ordered[1] !== ' ' : parts.checked
  const box = prefix + (ordered ? parts.marker.length + 1 : 3)
  view.dispatch({
    changes: { from: box, to: box + 1, insert: checked ? ' ' : 'x' },
    userEvent: 'format.task'
  })
  return true
}

export class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }
  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked
  }
  toDOM(view: EditorView): HTMLElement {
    const dom = document.createElement('span')
    dom.className = 'live-checkbox'
    dom.setAttribute('role', 'checkbox')
    dom.setAttribute('aria-checked', String(this.checked))
    dom.setAttribute('aria-label', 'Done')
    if (this.checked) dom.dataset.checked = 'true'
    // A click ticks the box in the text (`[x]`); it does not move the cursor or take focus.
    dom.addEventListener('mousedown', (event) => {
      event.preventDefault()
      toggleTaskAt(view, view.posAtDOM(dom))
    })
    return dom
  }
  /** The editor leaves the widget's own events to it. */
  ignoreEvent(): boolean {
    return true
  }
}
