import type { ParsedItem } from '../shared/types'
import { findDate } from '../shared/dates'
import { decodeEntities } from './parse-feed'

export interface ParsedPage {
  links: ParsedItem[]
  /** The page's readable text, whitespace collapsed; changes when the page does. */
  text: string
  /** The same text without the sections about past events, a line to each block: what dated sentences are cut from. */
  upcomingText: string
  /** The page says there is nothing coming ("There are currently no upcoming events"): it has no items. */
  none: boolean
}

/** Link texts that are the page's furniture, not something it announces. */
const FURNITURE =
  /^(skip to|read more|learn more|more|view all|see all|show more|home|menu|search|log ?in|sign ?in|register|contact|about|cookies?|privacy|terms|accessibility|sitemap|back to|next|previous|share|print|download|apply now|book now|find out more|click here|here)\b/i

/** Link texts that are the site's own credits and calls to action, never an event (a web designer's line, a cookie plugin, a newsletter box). */
export const CREDITS =
  /\b(website design|web design|designed by|built by|powered by|developed by|cookie|gdpr|sign up (?:for|to) (?:our|the)|subscribe|newsletter|get involved|follow us|terms (?:and|&) conditions|privacy)\b/i

/** A heading that opens a list of what is over. */
const PAST_HEADING =
  /^\s*(?:past|previous|earlier|archived?|old|finished)\b|\b(?:past|previous|archived?|earlier)\s+(?:events?|conferences?|meetings?|courses?|trainings?|editions?|webinars?)\s*$/i

/** Words that say a listing holds nothing coming. */
const NOTHING_COMING =
  /\b(?:no|zero)\s+(?:upcoming|forthcoming|scheduled|planned|future)\s+(?:events?|conferences?|courses?|trainings?|workshops?|meetings?|webinars?)\b/i

function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
}

function resolve(href: string, base: string): string | null {
  try {
    const u = new URL(decodeEntities(href.trim()), base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

/** Text with a line break where a block ends (a paragraph, a heading, a list item, a table row), so a sentence never runs on across blocks. */
const toLines = (html: string): string =>
  decodeEntities(
    html
      .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
      // A table row is one line, however its cells are wrapped (`<td><p>26/10/26</p></td><td><p>Title</p></td>`).
      .replace(/<tr\b[\s\S]*?<\/tr>/gi, (row) =>
        row
          .replace(/<\/?(?:p|div|li|br)\b[^>]*>/gi, ' ')
          .replace(/<\/t[dh]>/gi, ' ')
          .replace(/\s+/g, ' ')
      )
      .replace(
        /<\/(?:p|h[1-6]|li|div|tr|section|article|blockquote|figcaption)>|<br\s*\/?>/gi,
        '\n'
      )
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

const toText = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

/** The part of a page that is its content: the `<main>` when there is one, else the page without navigation, header, footer and aside. */
export function mainContent(html: string): string {
  const clean = stripNoise(html)
  const inner = /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(clean)
  return (inner ? inner[1] : clean)
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(div|ol|ul)\b[^>]*breadcrumb[^>]*>[\s\S]*?<\/\1>/gi, ' ')
}

/**
 * The page without the sections about what is over: from a heading such as "Past events" to the next heading of the same or a higher
 * level (or the end of the page).
 */
export function dropPastSections(html: string): string {
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  let out = ''
  let from = 0
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    if (!PAST_HEADING.test(toText(h[2]))) continue
    const start = h.index ?? 0
    if (start < from) continue
    const level = Number(h[1])
    const next = headings.slice(i + 1).find((n) => Number(n[1]) <= level)
    out += html.slice(from, start)
    from = next ? (next.index ?? html.length) : html.length
  }
  return out + html.slice(from)
}

/** A link to a section's own home page (`…/home.aspx`, `…/index.html`) that sits above the page being read: the site's menu, not an event. */
export function isSectionHome(url: string, base: string): boolean {
  try {
    const u = new URL(url)
    const dir = u.pathname.replace(/[^/]*$/, '')
    const file = u.pathname.slice(dir.length)
    return (
      (/^(?:home|index|default)(?:\.\w+)?$/i.test(file) || (file === '' && dir === '/')) &&
      new URL(base).pathname.startsWith(dir)
    )
  } catch {
    return false
  }
}

/** A link to the site's own search (`/search/?keywords=Public spending`): a card's tag, which finds events but is none. */
export function isSearchLink(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      /^\/search\/?$/i.test(u.pathname) ||
      ['keywords', 'keyword', 'q', 'query', 's', 'search'].some((k) => u.searchParams.has(k))
    )
  } catch {
    return false
  }
}

/** A link to a feed of the site's events (`/feed/?post_type=event`, `events.rss`, `.ics`): a "Follow our events" link, which holds events but is none. */
export function isFeedLink(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      /(?:^|\/)(?:feed|rss|atom)\/?$/i.test(u.pathname) ||
      /\.(?:rss|atom|xml|ics)$/i.test(u.pathname) ||
      u.searchParams.has('feed') ||
      ['rss', 'atom', 'ical', 'ics'].includes((u.searchParams.get('format') ?? '').toLowerCase())
    )
  } catch {
    return false
  }
}

const host = (url: string): string => new URL(url).hostname.replace(/^www\./, '')

/** Links worth watching and the page's text. Navigation and footer are left out, since they are the same on every visit and would only add noise. */
export function parsePage(html: string, baseUrl: string): ParsedPage {
  const whole = mainContent(html)
  const main = dropPastSections(whole)
  const none = NOTHING_COMING.test(toText(main))
  const links: ParsedItem[] = []
  const seen = new Set<string>()
  // A listing's card (`<li>` or `<article>`, up to its own closing tag) that holds one link is that link's own description and date;
  // a block with several links says nothing about any one of them, and what follows a card is no part of it.
  const collect = (part: string, card: boolean): void => {
    const found: ParsedItem[] = []
    const urls = new Set<string>()
    for (const m of part.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(m[1])
      if (!href) continue
      const url = resolve(href[1], baseUrl)
      if (!url || isSectionHome(url, baseUrl) || isSearchLink(url) || isFeedLink(url)) continue
      urls.add(url)
      if (seen.has(url)) continue
      const text = toText(m[2])
      // A card that is one link names its title in an element of its own ("cta__title"); the rest (a date, a blurb) is its summary.
      const own = /<(\w+)\b[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(m[2])
      const named = own ? toText(own[2]) : ''
      const title = named.length >= 12 ? named : text
      if (title.length < 12 || FURNITURE.test(title) || CREDITS.test(title)) continue
      seen.add(url)
      found.push({
        key: url,
        title,
        url,
        summary:
          title === named
            ? text
                .replace(title, ' ')
                .replace(title, ' ')
                .replace(/\bmore details\b/i, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 300)
            : '',
        publishedAt: null,
        ...(host(url) !== host(baseUrl) ? { offsite: true } : {})
      })
    }
    if (card && found.length === 1 && urls.size === 1) {
      const title = found[0].title
      found[0].summary = decodeEntities(
        part
          .replace(/<a\b[^>]*>\s*(?:view details|read more|find out more)[\s\S]*?<\/a>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
      )
        .replace(/\s+/g, ' ')
        .replace(title, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300)
    }
    links.push(...found)
  }
  for (const block of main.split(/(?=<(?:li|article)\b)/i)) {
    const isCard = /^<(?:li|article)\b/i.test(block)
    const end = isCard ? block.search(/<\/(?:li|article)>/i) : -1
    if (end < 0) {
      collect(block, false)
      continue
    }
    const close = block.indexOf('>', end) + 1
    collect(block.slice(0, close), true)
    collect(block.slice(close), false)
  }
  return {
    links: none ? [] : links,
    text: toText(whole),
    upcomingText: none ? '' : toLines(main),
    none
  }
}

const MAX_DATED_SENTENCES = 15
/** A timetable (dates in a table, read day-first) lists every session; the cap is for prose that happens to name dates. */
const MAX_TIMETABLE_ROWS = 200

const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/**
 * A numeric date (9/11/2026) is ambiguous, so it is read only on a page that shows its order: one date that cannot be month-first
 * (26/10/2026) and none that cannot be day-first. Such a page is day-first.
 */
export function numericDatesAreDayFirst(text: string): boolean {
  const found = [...text.matchAll(NUMERIC_DATE)].map((m) => [Number(m[1]), Number(m[2])])
  return found.some(([a]) => a > 12) && !found.some(([, b]) => b > 12)
}

/** A day-first page's numeric dates written out ("9/11/2026" as "9 November 2026"), so that the date reader finds them. */
function writeOutDates(sentence: string, dayFirst: boolean): string {
  if (!dayFirst || !NUMERIC_DATE.test(sentence)) return sentence
  NUMERIC_DATE.lastIndex = 0
  return (
    sentence
      // A timetable row's time ("26/10/26 10:00 - 13:00") is dropped, so the title follows the date.
      .replace(
        /(\b\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))\s+\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}\b/g,
        '$1'
      )
      .replace(NUMERIC_DATE, (all, d, m, y) =>
        Number(m) >= 1 && Number(m) <= 12
          ? `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y.length === 2 ? `20${y}` : y}`
          : all
      )
      .replace(/\s+([.,;])/g, '$1')
  )
}

/**
 * Sentences of a page's text that name a coming date ("EPS Meeting: University College London. 6th – 8th January
 * 2027."), for pages that announce things as prose rather than as links. Each one is an item of its own, found
 * again next time by its wording, so a rewritten sentence counts as new.
 */
export function datedSentences(text: string, pageUrl: string, today: string): ParsedItem[] {
  const out: ParsedItem[] = []
  const seen = new Set<string>()
  const dayFirst = numericDatesAreDayFirst(text)
  for (const raw of text.split(/(?<=[.!?])[^\S\n]+(?=[A-Z£"“(])|\n+/)) {
    const sentence = writeOutDates(raw.trim(), dayFirst)
    if (sentence.length < 25 || sentence.length > 260) continue
    if (!findDate(sentence, today)) continue
    const key = `text:${sentence
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .slice(0, 160)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, title: sentence, url: pageUrl, summary: '', publishedAt: null })
    if (out.length >= (dayFirst ? MAX_TIMETABLE_ROWS : MAX_DATED_SENTENCES)) break
  }
  return out
}
