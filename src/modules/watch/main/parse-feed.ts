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

/** A title that ends with its day in brackets, numerically: "Documents as Data - Online (09/03/27)". */
const TITLE_NUMERIC_DATE = /\s*\((\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\)\s*$/

/**
 * Titles ending "(dd/mm/yy)" (NCRM's training feed) have their date read and cut from the title. The order is ambiguous, so it is read
 * only when the feed shows it: one day above 12 in the first place and none in the second (as for a page's numeric dates).
 */
function readTitleDates(items: ParsedItem[]): void {
  const found = items.map((i) => TITLE_NUMERIC_DATE.exec(i.title))
  const numbers = found.flatMap((m) => (m ? [[Number(m[1]), Number(m[2])]] : []))
  if (!numbers.some(([d]) => d > 12) || numbers.some(([, m]) => m > 12)) return
  items.forEach((item, n) => {
    const m = found[n]
    if (!m) return
    const [day, month] = [Number(m[1]), Number(m[2])]
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return
    item.title = item.title.replace(TITLE_NUMERIC_DATE, '')
    item.dates = {
      eventStart: date.toISOString().slice(0, 10),
      eventEnd: null,
      deadline: null,
      deadlineLabel: null
    }
  })
}

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
  readTitleDates(items)
  return items
}
