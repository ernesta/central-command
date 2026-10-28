import type { ItemDates, ParsedItem } from '../shared/types'
import { decodeEntities } from './parse-feed'

/** The structured ways a site hands out its events: nothing here guesses from prose. Each gives a title, a start, an end and an address. */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/

const plain = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

const noDeadline = { deadline: null, deadlineLabel: null }

function dates(start: string | null, end: string | null): ItemDates {
  return {
    eventStart: start,
    eventEnd: start && end && end > start ? end : null,
    ...noDeadline
  }
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

// ---- The Events Calendar (WordPress "Tribe") REST API ----

/** Where its events are, when the page says it has them (a `wp-json/tribe/events/v1/` link, or the plugin's own classes), else null. */
export function tribeEndpoint(html: string, pageUrl: string): string | null {
  const advertised = /<link\b[^>]*href=["']([^"']*\/wp-json\/tribe\/events\/v1\/)["']/i.exec(html)
  if (advertised) return resolve(advertised[1], pageUrl)
  if (
    /class=["'][^"']*\btribe-events\b/i.test(html) ||
    /\/wp-content\/plugins\/the-events-calendar\//i.test(html)
  )
    return resolve('/wp-json/tribe/events/v1/', pageUrl)
  return null
}

/** The request for one page of the coming events (the API's own `start_date` is the day the list starts). */
export function tribeRequest(endpoint: string, today: string, page = 1): string {
  return `${endpoint.replace(/\/?$/, '/')}events?start_date=${today}&per_page=50&page=${page}`
}

interface Tribe {
  events: ParsedItem[]
  pages: number
}

/** The API's answer; throws when it is not one (so a site that stopped offering it is found out). */
export function parseTribe(body: string): Tribe {
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    throw new Error('The events calendar did not answer with data')
  }
  const o = data as { events?: unknown; total_pages?: unknown } | null
  if (!o || typeof o !== 'object' || !Array.isArray(o.events))
    throw new Error('The events calendar did not answer with events')
  const events: ParsedItem[] = []
  for (const e of o.events as Record<string, unknown>[]) {
    const title = typeof e.title === 'string' ? plain(e.title) : ''
    const url = typeof e.url === 'string' ? e.url : ''
    const start =
      typeof e.start_date === 'string' ? (ISO_DAY.exec(e.start_date)?.[0] ?? null) : null
    const end = typeof e.end_date === 'string' ? (ISO_DAY.exec(e.end_date)?.[0] ?? null) : null
    if (!title || !url || !start || e.status === 'draft') continue
    const venue = e.venue as { city?: unknown } | undefined
    const city = venue && typeof venue.city === 'string' ? venue.city : ''
    events.push({
      key: url,
      title,
      url,
      summary: [city, typeof e.description === 'string' ? plain(e.description) : '']
        .filter(Boolean)
        .join('. ')
        .slice(0, 300),
      publishedAt: null,
      dates: dates(start, end)
    })
  }
  return { events, pages: typeof o.total_pages === 'number' ? o.total_pages : 1 }
}

// ---- iCalendar ----

/** `.ics` addresses a page advertises: a `<link rel="alternate" type="text/calendar">` or a link to a calendar file or `?ical=1`. */
export function advertisedCalendars(html: string, pageUrl: string): string[] {
  const found: string[] = []
  const add = (href: string): void => {
    const url = resolve(href, pageUrl)
    if (url && !found.includes(url)) found.push(url)
  }
  for (const m of html.matchAll(/<link\b([^>]*)>/gi))
    if (/text\/calendar/i.test(m[1])) {
      const href = /href=["']([^"']+)["']/i.exec(m[1])
      if (href) add(href[1])
    }
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi))
    if (/\.ics(\?|$)|[?&]ical=1\b|[?&]outlook-ical=1\b/i.test(m[1])) add(m[1])
  return found
}

const icsDay = (value: string): string | null => {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(value)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

const dayBefore = (day: string): string => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

const unescapeIcs = (v: string): string =>
  v
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

/** The events of an iCalendar file; throws when the text is not one. */
export function parseIcs(text: string): ParsedItem[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('The calendar file is not a calendar')
  // Long lines are folded: a line that starts with a space or a tab continues the one before.
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const out: ParsedItem[] = []
  let event: Record<string, { value: string; params: string }> | null = null
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) event = {}
    else if (/^END:VEVENT/i.test(line)) {
      if (event) {
        const item = icsItem(event)
        if (item) out.push(item)
      }
      event = null
    } else if (event) {
      const m = /^([A-Za-z-]+)((?:;[^:]*)*):(.*)$/.exec(line)
      if (m) event[m[1].toUpperCase()] = { value: m[3], params: m[2] }
    }
  }
  return out
}

function icsItem(e: Record<string, { value: string; params: string }>): ParsedItem | null {
  const title = e.SUMMARY ? unescapeIcs(e.SUMMARY.value) : ''
  const start = e.DTSTART ? icsDay(e.DTSTART.value) : null
  if (!title || !start || /CANCELLED/i.test(e.STATUS?.value ?? '')) return null
  let end = e.DTEND ? icsDay(e.DTEND.value) : null
  // A whole-day event's end is the day after its last day.
  if (end && e.DTEND && /VALUE=DATE(?!-)/i.test(e.DTEND.params)) end = dayBefore(end)
  const url = e.URL ? e.URL.value.trim() : ''
  const key = url || (e.UID ? e.UID.value.trim() : `${title}|${start}`)
  return {
    key,
    title,
    url: url || key,
    summary: [
      e.LOCATION ? unescapeIcs(e.LOCATION.value) : '',
      e.DESCRIPTION ? unescapeIcs(e.DESCRIPTION.value) : ''
    ]
      .filter(Boolean)
      .join('. ')
      .slice(0, 300),
    publishedAt: null,
    dates: dates(start, end)
  }
}

// ---- schema.org Event, in JSON-LD ----

const isEventType = (type: unknown): boolean =>
  (Array.isArray(type) ? type : [type]).some(
    (t) => typeof t === 'string' && /(^|\/)(\w*Event|CourseInstance)$/.test(t)
  )

/** Every Event in the page's `application/ld+json` blocks: a single object, a `@graph`, an array, or an `ItemList`'s items. */
export function parseJsonLd(html: string, pageUrl: string): ParsedItem[] {
  const out: ParsedItem[] = []
  const seen = new Set<string>()
  const visit = (node: unknown, depth: number): void => {
    if (depth > 6 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1)
      return
    }
    const o = node as Record<string, unknown>
    if (isEventType(o['@type'])) {
      const item = jsonLdItem(o, pageUrl)
      if (item && !seen.has(item.key)) {
        seen.add(item.key)
        out.push(item)
      }
    }
    for (const k of ['@graph', 'itemListElement', 'item', 'subEvent', 'event'])
      if (o[k] !== undefined) visit(o[k], depth + 1)
  }
  for (const m of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      visit(JSON.parse(decodeEntities(m[1]).trim()), 0)
    } catch {
      // A block that is not valid JSON says nothing.
    }
  }
  return out
}

function jsonLdItem(o: Record<string, unknown>, pageUrl: string): ParsedItem | null {
  const text = (v: unknown): string => (typeof v === 'string' ? plain(v) : '')
  const title = text(o.name)
  const start = typeof o.startDate === 'string' ? (ISO_DAY.exec(o.startDate)?.[0] ?? null) : null
  const end = typeof o.endDate === 'string' ? (ISO_DAY.exec(o.endDate)?.[0] ?? null) : null
  if (!title || !start) return null
  if (/Cancel/i.test(typeof o.eventStatus === 'string' ? o.eventStatus : '')) return null
  const href = typeof o.url === 'string' ? o.url : typeof o['@id'] === 'string' ? o['@id'] : ''
  const url = (href && resolve(href, pageUrl)) || pageUrl
  return {
    key: href ? url : `${url}#${title}|${start}`,
    title,
    url,
    summary: text(o.description).slice(0, 300),
    publishedAt: null,
    dates: dates(start, end)
  }
}
