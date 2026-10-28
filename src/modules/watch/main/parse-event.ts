import { findDates } from '../shared/dates'
import type { ItemDates, ParsedItem } from '../shared/types'
import { decodeEntities } from './parse-feed'
import { mainContent } from './parse-page'

/** Reading a page that is one event (a society's annual conference): the page is the item, and its key-dates pages say its deadlines. */

const text = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

/** The name of the page's event: `og:title`, else the first `<h1>`, else the `<title>` without the site's name after a bar or dash. */
export function pageTitle(html: string): string {
  const og =
    /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i.exec(html)
  if (og) return decodeEntities(og[1]).trim()
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  if (h1 && text(h1[1])) return text(h1[1])
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return title ? text(title[1]).split(/\s[|–—-]\s/)[0] : ''
}

const EVENT_NAME =
  /\b(conference|congress|symposium|summit|annual meeting|workshop|summer school|colloquium)\b/i
const LISTING_NAME =
  /\b(future|upcoming|forthcoming|past|previous|events|conferences|meetings|workshops|calendar|listing|all)\b/i

/** A page named like one event rather than a list of them ("SSSR Thirty-Fourth Annual Conference", not "Future Meetings and Workshops"). */
export function namesOneEvent(title: string): boolean {
  return EVENT_NAME.test(title) && !LISTING_NAME.test(title)
}

const KEY_PAGE = [
  { score: 3, words: /key[- ]dates|deadlines?|important[- ]dates/i },
  { score: 2, words: /registration/i },
  { score: 1, words: /submissions?|call[- ]for[- ](papers|abstracts|proposals)|abstracts?/i }
]

/**
 * At most `limit` links on the same site that look like the event's key-dates page: the words are in the link's text or its path
 * ("SSSR 2027 Registration Details & Key Dates", /registration-and-key-dates). Links anywhere on the page count (the footer's
 * "Quick Links" hold them), because these are only followed, never shown as items.
 */
export function keyDateLinks(html: string, pageUrl: string, limit = 2): string[] {
  const here = new URL(pageUrl)
  const scored = new Map<string, number>()
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /href=["']([^"']+)["']/i.exec(m[1])
    if (!href) continue
    let url: URL
    try {
      url = new URL(decodeEntities(href[1]).trim(), pageUrl)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
    if (url.hostname.replace(/^www\./, '') !== here.hostname.replace(/^www\./, '')) continue
    url.hash = ''
    if (url.toString() === here.toString()) continue
    const label = `${text(m[2])} ${url.pathname.replace(/[-_/]+/g, ' ')}`
    const score = KEY_PAGE.find((k) => k.words.test(label))?.score ?? 0
    if (score > 0 && score > (scored.get(url.toString()) ?? 0)) scored.set(url.toString(), score)
  }
  return [...scored]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([u]) => u)
}

/**
 * The page's event as an item: its title, the event's dates read from the page's own text, and the earliest deadline still ahead in
 * that text or the key-dates pages' (`others`, the text of each). An event whose dates are all over has none (`dates` says so).
 */
export function eventItem(
  html: string,
  pageUrl: string,
  today: string,
  others: readonly string[] = []
): ParsedItem | null {
  const title = pageTitle(html)
  if (!title) return null
  const own = findDates(text(mainContent(html)), today)
  let deadline = own.deadline
  let label = own.deadlineLabel
  for (const other of others) {
    const found = findDates(other, today)
    if (found.deadline && (!deadline || found.deadline < deadline)) {
      deadline = found.deadline
      label = found.deadlineLabel
    }
  }
  const dates: ItemDates = {
    eventStart: own.eventStart,
    eventEnd: own.eventEnd,
    deadline,
    deadlineLabel: label
  }
  if (!dates.eventStart && !dates.deadline) return null
  return { key: pageUrl, title, url: pageUrl, summary: '', publishedAt: null, dates }
}
