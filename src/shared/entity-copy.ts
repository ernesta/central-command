import { findMentions, type EntityRef } from './entities'

/** What a kind of entity reads as outside the app. */
export interface CopyPart {
  /** In the running text, where the chip was. */
  text: string
  /** A reading's full reference, listed once at the end of what was copied. `html` carries its italics. */
  reference?: { text: string; html: string }
}

export interface ReadableCopy {
  text: string
  html: string
  /** The copied Markdown untouched, so pasting back into the app gives the chips again. */
  markdown: string
}

/** Marks the HTML flavour of the clipboard as ours; its value is the Markdown the text came from. */
export const COPY_MARKER = 'data-cc-markdown'

const REFERENCES_HEADING = 'References'

const unescapeLabel = (label: string): string => label.replace(/\\([!-/:-@[-`{-~])/g, '$1')

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Markdown copied out of a note as readable text: each mention becomes what `part` says (its label when that returns
 * null), and the references of the readings in the text follow, alphabetical, each once.
 * `render` turns the text into HTML (Markdown to HTML in the editor); without it the HTML is the text as plain paragraphs.
 */
export function readableCopy(
  markdown: string,
  part: (ref: EntityRef, label: string) => CopyPart | null,
  render?: (markdown: string) => string
): ReadableCopy {
  const mentions = findMentions(markdown)
  let body = ''
  let at = 0
  const references = new Map<string, { text: string; html: string }>()
  for (const m of mentions) {
    const label = unescapeLabel(m.label)
    const found = part(m.ref, label)
    body += markdown.slice(at, m.start) + (found?.text ?? label)
    at = m.end
    if (found?.reference) references.set(`${m.ref.kind}/${m.ref.key}`, found.reference)
  }
  body += markdown.slice(at)

  const list = [...references.values()].sort((a, b) => a.text.localeCompare(b.text))
  const lines = (s: string): string => escapeHtml(s).replace(/\r?\n/g, '<br>')
  let text = body
  let html = render ? render(body) : `<p>${lines(body)}</p>`
  if (list.length > 0) {
    text += `\n\n${REFERENCES_HEADING}\n${list.map((r) => r.text).join('\n')}`
    html += `<p>${REFERENCES_HEADING}</p>${list.map((r) => `<p>${r.html}</p>`).join('')}`
  }
  return {
    text,
    html: `<div ${COPY_MARKER}="${escapeHtml(markdown)}">${html}</div>`,
    markdown
  }
}

/** The Markdown a copy from this app carries in its HTML flavour, or null when the HTML is anyone else's. */
export function markdownFromCopy(html: string): string | null {
  const match = new RegExp(`<div ${COPY_MARKER}="([^"]*)"`).exec(html)
  if (!match) return null
  return match[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}
