import { markdownLanguage } from '@codemirror/lang-markdown'
import type { SyntaxNode } from '@lezer/common'

/*
 * Markdown as HTML, for the HTML flavour of a copy: Slack, Word and Google Docs read it, so headings, lists, bold and links
 * survive the paste. It walks the same GFM parse the editor uses, so what is drawn in the editor and what is copied agree.
 * Pure (no editor state), so it is tested on strings.
 */

const MARKS = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'CodeInfo',
  'HeaderMark',
  'ListMark',
  'QuoteMark',
  'TableDelimiter',
  'LinkMark',
  'LinkTitle',
  'LinkLabel'
])

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = (s: string): string => esc(s).replace(/"/g, '&quot;')

/** Plain text between two nodes: a line break (and the indent after it) becomes `<br>`, so each line stays a line. */
const gap = (md: string, from: number, to: number): string =>
  from >= to ? '' : esc(md.slice(from, to)).replace(/\r?\n[ \t]*/g, '<br>')

const tidy = (html: string): string =>
  html.replace(/(<br>)[ \t]+/g, '$1').replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, '')

function inline(md: string, node: SyntaxNode, stopAtLinkClose = false): string {
  let out = ''
  let at = node.from
  let linkMarks = 0
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (stopAtLinkClose && c.name === 'LinkMark' && ++linkMarks === 2) {
      out += gap(md, at, c.from)
      break
    }
    out += gap(md, at, c.from) + inlineNode(md, c)
    at = c.to
  }
  // When the loop stopped at the label's closing bracket, nothing after it (the address) is text.
  return stopAtLinkClose && linkMarks === 2 ? out : out + gap(md, at, node.to)
}

function inlineNode(md: string, node: SyntaxNode): string {
  const { name } = node
  if (MARKS.has(name)) return ''
  switch (name) {
    case 'Emphasis':
      return `<em>${inline(md, node)}</em>`
    case 'StrongEmphasis':
      return `<strong>${inline(md, node)}</strong>`
    case 'Strikethrough':
      return `<s>${inline(md, node)}</s>`
    case 'InlineCode':
      return `<code>${inline(md, node)}</code>`
    case 'Link':
    case 'Image': {
      const label = inline(md, node, true)
      const url = node.getChild('URL')
      if (name === 'Image') return label
      if (!url) return `[${label}]`
      return `<a href="${attr(md.slice(url.from, url.to))}">${label}</a>`
    }
    case 'URL': {
      const url = md.slice(node.from, node.to)
      return `<a href="${attr(url)}">${esc(url)}</a>`
    }
    case 'Escape':
      return esc(md.slice(node.from + 1, node.to))
    case 'Entity':
      return md.slice(node.from, node.to)
    case 'HardBreak':
      return '<br>'
    case 'TaskMarker':
      // Left out: a pasted ☐ is only a character in Word, so a to-do copies as a plain bullet.
      return ''
    default:
      return node.firstChild ? inline(md, node) : esc(md.slice(node.from, node.to))
  }
}

function children(md: string, node: SyntaxNode): string {
  let out = ''
  for (let c = node.firstChild; c; c = c.nextSibling) out += block(md, c)
  return out
}

/** A list item's own text sits straight in the `<li>` (no paragraph), like a typed list. */
function item(md: string, node: SyntaxNode): string {
  let out = ''
  for (let c = node.firstChild; c; c = c.nextSibling) {
    out += c.name === 'Paragraph' || c.name === 'Task' ? tidy(inline(md, c)) : block(md, c)
  }
  return `<li>${out}</li>`
}

function table(md: string, node: SyntaxNode): string {
  const cells = (row: SyntaxNode, tag: string): string => {
    let out = ''
    for (let c = row.firstChild; c; c = c.nextSibling) {
      if (c.name === 'TableCell') out += `<${tag}>${tidy(inline(md, c))}</${tag}>`
    }
    return `<tr>${out}</tr>`
  }
  let head = ''
  let body = ''
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'TableHeader') head = `<thead>${cells(c, 'th')}</thead>`
    if (c.name === 'TableRow') body += cells(c, 'td')
  }
  return `<table>${head}<tbody>${body}</tbody></table>`
}

function block(md: string, node: SyntaxNode): string {
  const { name } = node
  if (MARKS.has(name)) return ''
  const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name)
  if (heading) return `<h${heading[1]}>${tidy(inline(md, node))}</h${heading[1]}>`
  switch (name) {
    case 'Paragraph':
      return `<p>${tidy(inline(md, node))}</p>`
    case 'BulletList':
    case 'OrderedList': {
      const tag = name === 'BulletList' ? 'ul' : 'ol'
      let items = ''
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.name === 'ListItem') items += item(md, c)
      }
      return `<${tag}>${items}</${tag}>`
    }
    case 'Blockquote':
      return `<blockquote>${children(md, node)}</blockquote>`
    case 'FencedCode':
    case 'CodeBlock': {
      const lines = node.getChildren('CodeText').map((t) => md.slice(t.from, t.to))
      return `<pre><code>${esc(lines.join('\n'))}</code></pre>`
    }
    case 'HorizontalRule':
      return '<hr>'
    case 'Table':
      return table(md, node)
    case 'LinkReference':
      return ''
    default:
      return `<p>${tidy(gap(md, node.from, node.to))}</p>`
  }
}

/**
 * The HTML for `markdown`. One plain paragraph (a few words selected from a line) comes back as bare inline HTML, with no
 * `<p>`, so pasting it into the middle of a sentence does not start a new paragraph.
 */
export function markdownToHtml(markdown: string): string {
  const root = markdownLanguage.parser.parse(markdown).topNode
  const only = root.firstChild
  if (only && only.name === 'Paragraph' && !only.nextSibling) return tidy(inline(markdown, only))
  return children(markdown, root)
}
