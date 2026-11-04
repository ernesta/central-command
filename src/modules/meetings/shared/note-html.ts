import { markdownLanguage } from '@codemirror/lang-markdown'
import type { SyntaxNode } from '@lezer/common'
import { escapeHtml } from '@shared/report-page'
import { findMarkers } from './todos'
import { parseHeading, scanLines } from './sections'
import { meetingHeading } from './time'
import type { MeetingMeta } from './types'

/**
 * One meeting as a printable page: the heading and details, the Summary as a lead paragraph, then the rest of the note
 * (its Notes). Previous TODOs are left out. Pure and escaped, with no scripts or network resources, like the other
 * PDF pages. The note is read with the same Markdown parser the editor uses, so a note looks the same in both places.
 */

const BLOCK_NAMES = new Set([
  'Paragraph',
  'BulletList',
  'OrderedList',
  'Blockquote',
  'FencedCode',
  'CodeBlock',
  'Table',
  'HorizontalRule',
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
  'SetextHeading1',
  'SetextHeading2'
])

interface Marker {
  from: number
  to: number
  owners: string[]
}

interface Context {
  text: string
  /** Where a TODO marker sits in `text`, so it can be printed as its owner's name instead. */
  markers: Marker[]
  /** The markers already printed, since a marker can span a bold node and the text after it. */
  printed: Set<Marker>
}

const slice = (ctx: Context, from: number, to: number): string => ctx.text.slice(from, to)

function children(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = []
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c)
  return out
}

/** `**TODO (EO)**:` printed in bold with its owner's initials, "TODO(EO)" or "TODO(EO & KR)": the initials the note uses. */
function ownerLabel(ctx: Context, marker: Marker): string {
  if (ctx.printed.has(marker)) return ''
  ctx.printed.add(marker)
  const owners = marker.owners.length > 0 ? `(${marker.owners.join(' & ')})` : ''
  return `<strong>${escapeHtml(`TODO${owners}`)}</strong>`
}

/** Text between two nodes (or the start and end), with any TODO marker in it swapped for its owner label. */
function gap(ctx: Context, from: number, to: number): string {
  let out = ''
  let cur = from
  for (const m of ctx.markers) {
    if (cur >= to) break
    if (m.to <= cur || m.from >= to) continue
    if (m.from > cur) out += escapeHtml(slice(ctx, cur, m.from))
    out += ownerLabel(ctx, m)
    cur = Math.max(cur, m.to)
  }
  if (cur < to) out += escapeHtml(slice(ctx, cur, to))
  return out
}

function inlineNode(ctx: Context, node: SyntaxNode): string {
  const marker = ctx.markers.find((m) => node.from >= m.from && node.from < m.to)
  if (marker) return ownerLabel(ctx, marker)
  switch (node.name) {
    case 'StrongEmphasis':
      return `<strong>${inline(ctx, node, node.from, node.to)}</strong>`
    case 'Emphasis':
      return `<em>${inline(ctx, node, node.from, node.to)}</em>`
    case 'Strikethrough':
      return `<s>${inline(ctx, node, node.from, node.to)}</s>`
    case 'InlineCode': {
      const marks = children(node).filter((c) => c.name === 'CodeMark')
      const from = marks[0]?.to ?? node.from
      const to = marks.length > 1 ? marks[marks.length - 1].from : node.to
      return `<code>${escapeHtml(slice(ctx, from, to))}</code>`
    }
    case 'Link':
    case 'Image': {
      // The words of the link or the alt text; where it points means nothing on paper (and a mention is only a name).
      const marks = children(node).filter((c) => c.name === 'LinkMark')
      if (marks.length < 2) return inline(ctx, node, node.from, node.to)
      const words = inline(ctx, node, marks[0].to, marks[1].from)
      const url = node.getChild('URL')
      const href = url ? slice(ctx, url.from, url.to).trim() : ''
      return node.name === 'Link' && /^(?:https?:\/\/|mailto:)/i.test(href)
        ? `<a href="${escapeHtml(href)}">${words}</a>`
        : words
    }
    case 'HardBreak':
      return '<br>'
    case 'Escape':
      return escapeHtml(slice(ctx, node.from + 1, node.to))
    case 'Entity': {
      const entity = slice(ctx, node.from, node.to)
      return /^&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);$/i.test(entity) ? entity : escapeHtml(entity)
    }
    case 'HTMLTag':
    case 'Comment':
    case 'ProcessingInstruction':
      return ''
    default:
      // Marks (`**`, `[`, `` ` ``…) print nothing; any other node is shown as the text it covers.
      if (node.name.endsWith('Mark')) return ''
      return escapeHtml(slice(ctx, node.from, node.to))
  }
}

/** The inline content of `parent` between `from` and `to`: its text and the spans inside it. */
function inline(ctx: Context, parent: SyntaxNode, from: number, to: number): string {
  let out = ''
  let pos = from
  for (const c of children(parent)) {
    if (c.to <= from || c.from >= to) continue
    if (BLOCK_NAMES.has(c.name)) break
    out += gap(ctx, pos, Math.max(pos, c.from))
    out += inlineNode(ctx, c)
    pos = Math.max(pos, c.to)
  }
  return out + gap(ctx, pos, to)
}

function heading(ctx: Context, node: SyntaxNode): string {
  const level = Number(node.name.slice(-1))
  const marks = children(node).filter((c) => c.name === 'HeaderMark')
  let from = node.from
  let to = node.to
  if (node.name.startsWith('ATX')) {
    from = marks[0]?.to ?? from
    if (marks.length > 1) to = marks[marks.length - 1].from
  } else {
    to = marks[marks.length - 1]?.from ?? to
  }
  // # ## ### #### are <h2> to <h5> (the page's title is the <h1>); deeper levels print as the last.
  const tag = Math.min(level, 4) + 1
  return `<h${tag}>${inline(ctx, node, from, to).trim()}</h${tag}>`
}

function listItem(ctx: Context, item: SyntaxNode): { html: string; task: boolean } {
  const mark = item.getChild('ListMark')
  const task = item.getChild('Task')
  const taskMarker = task?.getChild('TaskMarker') ?? null
  const holder = task ?? item
  const from = taskMarker?.to ?? mark?.to ?? item.from
  const kids = children(item).filter((c) => BLOCK_NAMES.has(c.name))
  // A plain item's first line is a Paragraph of its own, which is its lead rather than a paragraph under it; a checkbox item's is inline in the item.
  const para = !task && kids[0]?.name === 'Paragraph' ? kids[0] : null
  const to = task ? task.to : (kids[0]?.from ?? item.to)
  const lead = para
    ? inline(ctx, para, para.from, para.to).trim()
    : inline(ctx, holder, from, Math.max(from, to)).trim()
  const rest = kids
    .filter((c) => c !== para)
    .map((c) => blockNode(ctx, c))
    .join('\n')
  if (!taskMarker) return { html: `<li>${lead}${rest}</li>`, task: false }
  const done = /[xX]/.test(slice(ctx, taskMarker.from, taskMarker.to))
  return { html: `<li${done ? ' class="done"' : ''}>${lead}${rest}</li>`, task: true }
}

function table(ctx: Context, node: SyntaxNode): string {
  const row = (r: SyntaxNode, cell: 'th' | 'td'): string =>
    `<tr>${children(r)
      .filter((c) => c.name === 'TableCell')
      .map((c) => `<${cell}>${inline(ctx, c, c.from, c.to).trim()}</${cell}>`)
      .join('')}</tr>`
  const head = node.getChild('TableHeader')
  const rows = children(node).filter((c) => c.name === 'TableRow')
  return `<table>${head ? `<thead>${row(head, 'th')}</thead>` : ''}<tbody>${rows.map((r) => row(r, 'td')).join('')}</tbody></table>`
}

function blockNode(ctx: Context, node: SyntaxNode): string {
  switch (node.name) {
    case 'Paragraph':
      return `<p>${inline(ctx, node, node.from, node.to).trim()}</p>`
    case 'BulletList':
    case 'OrderedList': {
      const items = children(node)
        .filter((c) => c.name === 'ListItem')
        .map((c) => listItem(ctx, c))
      const tag = node.name === 'BulletList' ? 'ul' : 'ol'
      return `<${tag}>${items.map((i) => i.html).join('')}</${tag}>`
    }
    case 'Blockquote':
      return `<blockquote>${blocks(ctx, node)}</blockquote>`
    case 'FencedCode': {
      const code = children(node).filter((c) => c.name === 'CodeText')
      const text = code.length > 0 ? slice(ctx, code[0].from, code[code.length - 1].to) : ''
      return `<pre>${escapeHtml(text)}</pre>`
    }
    case 'CodeBlock': {
      const text = slice(ctx, node.from, node.to).replace(/^ {1,4}/gm, '')
      return `<pre>${escapeHtml(text)}</pre>`
    }
    case 'HorizontalRule':
      return '<hr>'
    case 'Table':
      return table(ctx, node)
    default:
      return heading(ctx, node)
  }
}

function blocks(ctx: Context, parent: SyntaxNode): string {
  return children(parent)
    .filter((c) => BLOCK_NAMES.has(c.name))
    .map((c) => blockNode(ctx, c))
    .join('\n')
}

/** Where the TODO markers sit in a piece of Markdown (not inside code fences or code spans). */
function todoMarkers(text: string): Marker[] {
  const found: Marker[] = []
  for (const line of scanLines(text)) {
    if (line.inFence) continue
    for (const m of findMarkers(line.text)) {
      found.push({ from: line.start + m.index, to: line.start + m.end, owners: m.owners })
    }
  }
  return found
}

/** A piece of a note as HTML: paragraphs, headings, lists (TODOs as bullets), quotes, tables and code. */
export function markdownHtml(text: string): string {
  const tree = markdownLanguage.parser.parse(text)
  const ctx: Context = { text, markers: todoMarkers(text), printed: new Set() }
  return blocks(ctx, tree.topNode)
}

interface Section {
  title: string | null
  /** 1 or 2: the heading's own level, so its size matches the same heading inside a note. */
  level: number
  text: string
}

/** The note cut at its `#` and `##` headings (not inside code); anything before the first is a section with no title. */
function sections(body: string): Section[] {
  const out: Section[] = [{ title: null, level: 2, text: '' }]
  const lines: string[][] = [[]]
  for (const line of scanLines(body)) {
    const title = line.inFence ? null : parseHeading(line.text)
    if (title && title.level <= 2) {
      out.push({ title: title.text, level: title.level, text: '' })
      lines.push([])
    } else {
      lines[lines.length - 1].push(line.text)
    }
  }
  return out.map((s, i) => ({ ...s, text: lines[i].join('\n') }))
}

/** The note's body as HTML: the Summary first, every other section under a plain heading (Notes without one), Previous TODOs not at all. */
export function noteBodyHtml(body: string): string {
  return sections(body)
    .map(({ title, level, text }) => {
      const content = text.trim() === '' ? '' : markdownHtml(text)
      if (content === '') return ''
      const key = title?.trim().toLowerCase()
      if (key === 'previous todos') return ''
      if (key === 'summary') return `<div class="summary">${content}</div>`
      // The note's own "Notes" section needs no label: it is the note.
      return title === null || key === 'notes'
        ? content
        : `<h${level + 1}>${escapeHtml(title)}</h${level + 1}>\n${content}`
    })
    .filter((s) => s !== '')
    .join('\n')
}

/** The page's heading, the same as the meeting's own page. */
export function noteTitle(meta: Pick<MeetingMeta, 'series' | 'date'>): string {
  return meetingHeading(meta.series, meta.date)
}

/** "10:00–11:00 · Alice, Bob": the time (no length) and the attendees, on one line. */
export function noteDetails(meta: MeetingMeta): string {
  const time = meta.start && meta.end ? `${meta.start}–${meta.end}` : (meta.start ?? '')
  return [time, meta.attendees.join(', ')].filter((part) => part).join(' · ')
}

/** The footer on every page: the title on the left, the page count on the right. Chromium fills in the two classes. */
export function noteFooter(title: string): string {
  return `<div style="box-sizing:border-box;width:100%;padding:0 22mm;display:flex;justify-content:space-between;font:7.5pt Georgia,'Times New Roman',serif;color:#8a939e"><span>${escapeHtml(title)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`
}

/** The name suggested when saving: "2026 11 13 Supervision.pdf" (no dashes). */
export function noteFileName(meta: Pick<MeetingMeta, 'series' | 'date'>): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? meta.date.replace(/-/g, ' ') : ''
  const name = [date, meta.series || 'Meeting']
    .filter((part) => part)
    .join(' ')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${name}.pdf`
}

/** A printable note page: the title, an optional one-line subtitle and the body HTML. Shared by the meeting and the note export. */
export function notePageHtml(input: { title: string; details: string; bodyHtml: string }): string {
  const { title, details, bodyHtml } = input
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: 18mm 20mm 22mm; }
body { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 10pt; line-height: 1.45; color: #1b222b; }
h1 { margin: 0 0 4px; font-size: 18pt; }
.sub { margin: 0 0 14px; color: #5c6672; font-size: 9pt; }
/* Every heading is bold and upright and only the size differs: # 16pt, ## 14pt, ### 11.5pt, #### 10pt. The same in a meeting's and a note's page. Steps under 2pt read as the same size. */
h2 { margin: 18px 0 4px; font-size: 16pt; }
h3 { margin: 14px 0 4px; font-size: 14pt; }
h4 { margin: 10px 0 3px; font-size: 11.5pt; }
h5 { margin: 8px 0 2px; font-size: 10pt; }
p { margin: 0 0 6px; }
ul, ol { margin: 0 0 6px; padding-left: 18px; }
li { margin: 0 0 2px; }
.done { color: #8a939e; text-decoration: line-through; }
blockquote { margin: 0 0 6px; padding-left: 12px; border-left: 2px solid #c3cad2; color: #5c6672; }
pre { margin: 0 0 6px; padding: 6px 8px; background: #f3f5f7; font: 8.5pt Menlo, monospace; white-space: pre-wrap; }
code { font: 9pt Menlo, monospace; }
hr { border: 0; border-top: 0.5px solid #c3cad2; margin: 10px 0; }
table { width: 100%; border-collapse: collapse; margin: 0 0 8px; font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; }
th { text-align: left; padding: 4px 6px; border-bottom: 1.5px solid #1b222b; font-size: 8pt; }
td { padding: 4px 6px; border-bottom: 0.5px solid #c3cad2; vertical-align: top; }
tr { break-inside: avoid; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${details ? `<p class="sub">${escapeHtml(details)}</p>\n` : ''}${bodyHtml}
</body>
</html>
`
}

/** The whole page for one meeting. */
export function meetingNoteHtml(input: { meta: MeetingMeta; body: string }): string {
  const { meta, body } = input
  return notePageHtml({
    title: noteTitle(meta),
    details: noteDetails(meta),
    bodyHtml: noteBodyHtml(body)
  })
}
