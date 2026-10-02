import {
  EditorSelection,
  Facet,
  Prec,
  StateEffect,
  type EditorState,
  type Extension
} from '@codemirror/state'
import { EditorView, ViewPlugin, WidgetType, type ViewUpdate } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { entityHref, escapeLabel, parseEntityHref, type EntityRef } from '@shared/entities'
import type { EntityHost, MentionTarget, Suggestion } from '../entities/mention-target'
import { suggestionIn } from '../entities/mention-target'
import { treeTo } from './live-lines'

/*
 * Mentions in the live editor. The text stays `[label](cc://kind/key)` (the file format is unchanged); this file draws it
 * as a chip, an atomic replace widget the cursor jumps over and Backspace removes whole, and opens the `@` picker.
 */

/** What the editor needs from outside for mentions: the picker and resolver, and how to open what a chip points at. */
export interface LiveEntities {
  host: EntityHost
  open: (ref: EntityRef) => void
}

const NO_ENTITIES: LiveEntities = {
  host: {
    resolve: () => ({ state: 'pending' }),
    suggest: () => undefined,
    handleKey: () => false,
    copyPart: async () => null,
    detach: () => undefined
  },
  open: () => undefined
}

export const entitiesFacet = Facet.define<LiveEntities, LiveEntities>({
  combine: (values) => values[0] ?? NO_ENTITIES
})

/** An effect with no content: what a mention points at has been looked up, so the chips are drawn again. */
export const refreshMentions = StateEffect.define<null>()

/** A mention in the text that is drawn as a chip. */
export interface Chip {
  from: number
  to: number
  label: string
  ref: EntityRef
}

/** The label as it reads: `\[` and `\]` (and any escaped punctuation) without their backslashes. */
const unescape = (label: string): string => label.replace(/\\([!-/:-@[-`{-~])/g, '$1')

/**
 * The chip a `Link` node is, or null when it is not one: a plain `[label](cc://kind/key)` with a label, an address of
 * ours and no title, all on one line (a replaced range may not cross a line break).
 */
export function chipOf(state: EditorState, node: SyntaxNode): Chip | null {
  if (node.name !== 'Link') return null
  const marks = node.getChildren('LinkMark')
  const url = node.getChild('URL')
  if (marks.length !== 4 || !url || node.getChild('LinkTitle')) return null
  if (state.sliceDoc(marks[2].from, marks[2].to) !== '(') return null
  const ref = parseEntityHref(state.sliceDoc(url.from, url.to).replace(/^<|>$/g, ''))
  const label = state.sliceDoc(marks[0].to, marks[1].from)
  if (!ref || label === '') return null
  if (state.doc.lineAt(node.from).to < node.to) return null
  return { from: node.from, to: node.to, label: unescape(label), ref }
}

/** The chip that ends at `pos`, or null. */
export function chipEndingAt(state: EditorState, pos: number): Chip | null {
  for (
    let node: SyntaxNode | null = treeTo(state, pos).resolveInner(pos, -1);
    node;
    node = node.parent
  ) {
    if (node.name === 'Link') {
      const chip = chipOf(state, node)
      return chip && chip.to === pos ? chip : null
    }
  }
  return null
}

/** The chip that starts at `pos`, or null. */
export function chipStartingAt(state: EditorState, pos: number): Chip | null {
  for (
    let node: SyntaxNode | null = treeTo(state, pos + 1).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    if (node.name === 'Link') {
      const chip = chipOf(state, node)
      return chip && chip.from === pos ? chip : null
    }
  }
  return null
}

/** The chip drawn in place of a mention: the icon of its kind and the label, struck through when what it points at is gone. */
export class ChipWidget extends WidgetType {
  constructor(
    readonly chip: Pick<Chip, 'label' | 'ref'>,
    readonly missing: boolean,
    readonly open: (ref: EntityRef) => void
  ) {
    super()
  }
  eq(other: ChipWidget): boolean {
    return (
      other.chip.label === this.chip.label &&
      other.chip.ref.kind === this.chip.ref.kind &&
      other.chip.ref.key === this.chip.ref.key &&
      other.missing === this.missing
    )
  }
  toDOM(): HTMLElement {
    const dom = document.createElement('span')
    dom.className = 'live-chip'
    dom.dataset.kind = this.chip.ref.kind
    dom.dataset.key = this.chip.ref.key
    if (this.missing) dom.dataset.missing = 'true'
    dom.style.setProperty('--entity-icon', `var(--entity-icon-${this.chip.ref.kind})`)
    dom.setAttribute('spellcheck', 'false')
    dom.textContent = this.chip.label
    // Cmd (Ctrl) with a click opens what the chip points at, this very chip (a position next to two chips could be either).
    dom.addEventListener('mousedown', (event) => {
      if (!(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      this.open(this.chip.ref)
    })
    return dom
  }
  /** The chip handles Cmd-click itself; any other click is the editor's, which puts the cursor beside the chip. */
  ignoreEvent(event: Event): boolean {
    return (
      event.type === 'mousedown' && ((event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey)
    )
  }
}

/** Backspace right after a chip, or Delete right before one, removes the whole mention. */
export const deleteChip =
  (forward: boolean) =>
  (view: EditorView): boolean => {
    const { state } = view
    const range = state.selection.main
    if (state.selection.ranges.length !== 1 || !range.empty) return false
    const chip = forward ? chipStartingAt(state, range.head) : chipEndingAt(state, range.head)
    if (!chip) return false
    view.dispatch({
      changes: { from: chip.from, to: chip.to },
      scrollIntoView: true,
      userEvent: 'delete.chip'
    })
    return true
  }

const NOT_A_PLACE_FOR_A_MENTION = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'CodeText',
  'Link',
  'Image',
  'URL',
  'Autolink',
  'HTMLTag'
])

/**
 * The `@…` the cursor is at the end of, or null. Not in code or a link, not once the query has run on (more than a
 * short phrase, or two spaces in a row), and not with text selected.
 */
export function findSuggestion(state: EditorState): Suggestion | null {
  const { selection } = state
  if (selection.ranges.length !== 1 || !selection.main.empty) return null
  const pos = selection.main.head
  const line = state.doc.lineAt(pos)
  const found = suggestionIn(state.sliceDoc(line.from, pos))
  if (!found) return null
  for (
    let node: SyntaxNode | null = treeTo(state, pos).resolveInner(pos, -1);
    node;
    node = node.parent
  )
    if (NOT_A_PLACE_FOR_A_MENTION.has(node.name)) return null
  return { from: line.from + found.at, to: pos, query: found.query }
}

/** The picker's view of a live editor. `caret` is where the cursor is on screen, read while the editor measures. */
export function liveTarget(
  view: EditorView,
  caret?: { left: number; top: number; bottom: number }
): MentionTarget {
  return {
    coordsAt: (pos) => caret ?? view.coordsAtPos(pos) ?? { left: 0, top: 0, bottom: 0 },
    refresh: () => view.dispatch({ effects: refreshMentions.of(null) }),
    current: () => findSuggestion(view.state),
    insert: (suggestion, label, ref) => {
      const text = `[${escapeLabel(label)}](${entityHref(ref)})`
      view.dispatch({
        changes: { from: suggestion.from, to: suggestion.to, insert: text },
        selection: EditorSelection.cursor(suggestion.from + text.length),
        scrollIntoView: true,
        userEvent: 'input.complete'
      })
      view.focus()
    }
  }
}

/** Tells the picker what the cursor is at the end of: when `@…` appears, changes or goes. */
const suggestPlugin = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {
      // The picker also draws the chips again when something they point at arrives, so it must know this editor at once.
      this.host().suggest(liveTarget(view), null)
    }
    host(): EntityHost {
      return this.view.state.facet(entitiesFacet).host
    }
    update(update: ViewUpdate): void {
      if (!update.docChanged && !update.selectionSet && !update.focusChanged) return
      // The screen position of the `@` (where the list stays) is read once the editor has laid itself out, not in the middle of an update.
      update.view.requestMeasure({
        key: this,
        read: (view) => {
          const found = view.hasFocus ? findSuggestion(view.state) : null
          return { found, caret: found ? view.coordsAtPos(found.from) : null }
        },
        write: ({ found, caret }, view) =>
          this.host().suggest(liveTarget(view, caret ?? undefined), caret ? found : null)
      })
    }
    destroy(): void {
      this.host().detach()
    }
  }
)

/** Everything mentions need beyond the drawing (`live-decorations.ts`): the `@` picker's keys, its trigger, the punctuation rule. */
export function entityExtensions(entities: LiveEntities = NO_ENTITIES): Extension[] {
  return [
    entitiesFacet.of(entities),
    suggestPlugin,
    // The picker gets the arrows, Enter, Tab and Escape before any other binding while it is open.
    Prec.highest(
      EditorView.domEventHandlers({
        keydown: (event, view) => view.state.facet(entitiesFacet).host.handleKey(event)
      })
    )
  ]
}
