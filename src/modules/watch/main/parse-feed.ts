import type { ParsedItem } from '../shared/types'

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u0020'
}

/** Text with the XML/HTML entities a feed uses turned back into characters. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : whole
    }
    return ENTITIES[name.toLowerCase()] ?? whole
  })
}

function unwrap(raw: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw)
  return cdata ? cdata[1] : decodeEntities(raw)
}

/** Readable plain text from a feed's description, which may hold HTML. */
export function plainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return m ? unwrap(m[1]).trim() : null
}

function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)]
  const pick =
    links.find((l) => /rel=["']alternate["']/i.test(l[1])) ??
    links.find((l) => !/rel=/i.test(l[1])) ??
    links[0]
  const href = pick ? /href=["']([^"']+)["']/i.exec(pick[1]) : null
  return href ? decodeEntities(href[1]) : null
}

/** A date a feed gives, as an ISO string, or null when it cannot be read. */
function isoDate(value: string | null): string | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

const MAX_SUMMARY = 1200

/** The entries of an RSS 2.0 or Atom feed. Throws when the text is not a feed, so a login page is not taken for an empty one. */
export function parseFeed(xml: string): ParsedItem[] {
  const isRss = /<rss[\s>]|<rdf:RDF[\s>]/i.test(xml)
  const isAtom = /<feed[\s>]/i.test(xml)
  if (!isRss && !isAtom) throw new Error('Not a feed')
  const blocks = [
    ...xml.matchAll(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi)
  ]
  const items: ParsedItem[] = []
  for (const [block] of blocks) {
    const title = plainText(tag(block, 'title') ?? '')
    const url = (isAtom ? atomLink(block) : tag(block, 'link')) ?? ''
    if (!title || !url) continue
    const guid = tag(block, isAtom ? 'id' : 'guid') ?? url
    const body =
      tag(block, isAtom ? 'summary' : 'description') ??
      tag(block, 'content') ??
      tag(block, 'content:encoded') ??
      ''
    items.push({
      key: guid || url,
      title,
      url,
      summary: plainText(body).slice(0, MAX_SUMMARY),
      publishedAt: isoDate(
        tag(block, isAtom ? 'published' : 'pubDate') ??
          tag(block, 'updated') ??
          tag(block, 'dc:date')
      )
    })
  }
  return items
}
