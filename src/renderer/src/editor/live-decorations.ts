import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import { blockRevealed, computeReveal, spanRevealed, type Extent, type Reveal } from './live-reveal'

/*
 * The formatting layer. The document is the Markdown text and is never touched here: everything below is a
 * decoration, so a bug in this file can make a note look wrong but cannot change what it says.
 *
 *  - classes (`live-h1`, `live-strong`, ...) style the text between markers;
 *  - markers (`###`, `**`, `[`, `](url)`) are hidden with `Decoration.replace` unless the reveal rules
 *    (`live-reveal.ts`) say the cursor is there, when they stay put and get the `live-marker` colour.
 */

const hidden = Decoration.replace({})
const markerMark = Decoration.mark({ class: 'live-marker' })

function classMark(name: string): Decoration {
  return Decoration.mark({ class: name })
}
const MARKS = {
  em: classMark('live-em'),
  strong: classMark('live-strong'),
  strike: classMark('live-strike'),
  code: classMark('live-code'),
  link: classMark('live-link'),
  url: classMark('live-url'),
  listMark: classMark('live-listmark')
}

const lineDeco = (name: string, style?: string): Decoration =>
  Decoration.line({ class: name, ...(style ? { attributes: { style } } : {}) })

/** Nodes of the `Emphasis`/`StrongEmphasis`/`Strikethrough` kind, with the name of their marker children. */
const SPANS: Record<string, { marker: string; mark: Decoration }> = {
  Emphasis: { marker: 'EmphasisMark', mark: MARKS.em },
  StrongEmphasis: { marker: 'EmphasisMark', mark: MARKS.strong },
  Strikethrough: { marker: 'StrikethroughMark', mark: MARKS.strike },
  InlineCode: { marker: 'CodeMark', mark: MARKS.code }
}

export function buildDecorations(
  state: EditorState,
  reveal: Reveal,
  visible: readonly Extent[]
): DecorationSet {
  const doc = state.doc
  const out: Range<Decoration>[] = []
  const seen = new Set<string>()
  const add = (kind: string, from: number, to: number, deco: Decoration): void => {
    const key = `${kind}:${from}:${to}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(deco.range(from, to))
  }
  const text = (from: number, to: number): string => doc.sliceString(from, to)

  /** Each line the node covers (within the visible range) gets the class. */
  const lines = (
    nodeFrom: number,
    nodeTo: number,
    range: Extent,
    fn: (lineFrom: number) => void
  ): void => {
    for (let pos = Math.max(nodeFrom, range.from); pos <= Math.min(nodeTo, range.to);) {
      const line = doc.lineAt(pos)
      fn(line.from)
      pos = line.to + 1
    }
  }
  const lineClass = (nodeFrom: number, nodeTo: number, range: Extent, name: string): void =>
    lines(nodeFrom, nodeTo, range, (at) => add(`line-${name}`, at, at, lineDeco(name)))

  /** A marker: hidden, or shown in the marker colour when its span or block is revealed. */
  const marker = (from: number, to: number, shown: boolean): void => {
    if (from < to) add('marker', from, to, shown ? markerMark : hidden)
  }
  /** The marker and the single space that follows it (`### `, `> `). */
  const markerAndSpace = (from: number, to: number, shown: boolean): void =>
    marker(from, text(to, to + 1) === ' ' ? to + 1 : to, shown)

  for (const range of visible) {
    const quoteDepth = new Map<number, number>()
    let depth = 0

    // Blank lines are shorter than text lines, so the gap between paragraphs is a paragraph gap.
    for (let pos = range.from; pos <= range.to;) {
      const line = doc.lineAt(pos)
      if (line.length === 0) add('blank', line.from, line.from, lineDeco('live-blank'))
      pos = line.to + 1
    }

    syntaxTree(state).iterate({
      from: range.from,
      to: range.to,
      enter(node: SyntaxNodeRef) {
        const name = node.name
        const heading = /^ATXHeading([1-6])$/.exec(name)
        if (heading) {
          lineClass(node.from, node.to, range, `live-h${heading[1]}`)
          const [first, ...rest] = node.node.getChildren('HeaderMark')
          const shown = blockRevealed(reveal, node.from, node.to)
          if (first && first.from === node.from) markerAndSpace(first.from, first.to, shown)
          for (const mark of rest) marker(mark.from, mark.to, shown)
          return
        }
        const setext = /^SetextHeading([12])$/.exec(name)
        if (setext) {
          const underline = node.node.getChild('HeaderMark')
          const textEnd = underline ? doc.lineAt(underline.from).from - 1 : node.to
          lineClass(node.from, textEnd, range, `live-h${setext[1]}`)
          if (underline) {
            const shown = blockRevealed(reveal, node.from, node.to)
            marker(underline.from, underline.to, shown)
            if (!shown) lineClass(underline.from, underline.to, range, 'live-blank')
          }
          return
        }
        const span = SPANS[name]
        if (span) {
          const marks = node.node.getChildren(span.marker)
          if (marks.length < 2) return
          const first = marks[0]
          const last = marks[marks.length - 1]
          const shown = spanRevealed(reveal, node.from, node.to)
          if (first.to < last.from) add('content', first.to, last.from, span.mark)
          marker(first.from, first.to, shown)
          marker(last.from, last.to, shown)
          return
        }
        switch (name) {
          case 'Blockquote':
            depth += 1
            lines(node.from, node.to, range, (at) =>
              quoteDepth.set(at, Math.max(quoteDepth.get(at) ?? 0, depth))
            )
            return
          case 'QuoteMark':
            markerAndSpace(node.from, node.to, blockRevealed(reveal, node.from, node.to))
            return
          case 'HorizontalRule': {
            const shown = blockRevealed(reveal, node.from, node.to)
            lineClass(node.from, node.to, range, shown ? 'live-hr-open' : 'live-hr')
            marker(node.from, node.to, shown)
            return
          }
          case 'FencedCode':
          case 'CodeBlock':
            lineClass(node.from, node.to, range, 'live-codeblock')
            for (const mark of node.node.getChildren('CodeMark'))
              add('marker', mark.from, mark.to, markerMark)
            return
          case 'Table':
            lineClass(node.from, node.to, range, 'live-table')
            return
          case 'ListMark':
          case 'TaskMarker':
            add('listmark', node.from, node.to, MARKS.listMark)
            return
          case 'Link': {
            const marks = node.node.getChildren('LinkMark')
            // Only the inline form, `[label](address)`; `[a][b]` and friends are shown as they are.
            if (marks.length < 4 || text(marks[2].from, marks[2].to) !== '(') return
            const open = marks[0]
            const close = marks[1]
            if (open.to < close.from) add('label', open.to, close.from, MARKS.link)
            const shown = open.to === close.from || spanRevealed(reveal, node.from, node.to)
            marker(open.from, open.to, shown)
            marker(close.from, node.to, shown)
            if (shown)
              for (const part of node.node.getChildren('URL'))
                add('url', part.from, part.to, MARKS.url)
            return
          }
          case 'URL': {
            const parent = node.node.parent?.name
            // Inside `[label](...)` it is part of the marker; an address written out in the text is a link.
            if (parent === 'Link' || parent === 'Image' || parent === 'LinkReference') return
            add('label', node.from, node.to, MARKS.link)
            return
          }
        }
      },
      leave(node: SyntaxNodeRef) {
        if (node.name === 'Blockquote') depth -= 1
      }
    })

    for (const [at, level] of quoteDepth)
      add(`quote`, at, at, lineDeco('live-quote', `--quote-depth: ${level}`))
  }

  return Decoration.set(out, true)
}

/** Rebuilds the decorations when the text, selection, focus, viewport or parse changes. */
export const liveDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }
    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.focusChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      )
        this.decorations = this.build(update.view)
    }
    build(view: EditorView): DecorationSet {
      return buildDecorations(
        view.state,
        computeReveal(view.state, view.hasFocus),
        view.visibleRanges
      )
    }
  },
  { decorations: (plugin) => plugin.decorations }
)
