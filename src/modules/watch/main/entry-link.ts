import { findDates } from '../shared/dates'
import { sectionOf, type EntryLinkRead } from '../shared/types'
import type { Fetcher } from './checker'
import { USER_AGENT, describeFetchError, statusError } from './load-source'
import { decodeEntities } from './parse-feed'
import { pageTitle } from './parse-event'
import { mainContent } from './parse-page'
import { validSourceUrl } from './repository'

const meta = (html: string, names: string[]): string => {
  for (const name of names) {
    const a = new RegExp(
      `<meta\\b[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`,
      'i'
    ).exec(html)
    const b = new RegExp(
      `<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
      'i'
    ).exec(html)
    const found = a?.[1] ?? b?.[1]
    if (found?.trim()) return decodeEntities(found).replace(/\s+/g, ' ').trim()
  }
  return ''
}

const textOf = (html: string): string =>
  decodeEntities(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

const EMPTY = (url: string, notice: string | null): EntryLinkRead => ({
  url,
  title: '',
  summary: '',
  section: 'conference',
  eventDate: null,
  eventEnd: null,
  deadline: null,
  deadlineLabel: null,
  notice
})

/**
 * Reads the page a pasted link points to, once, to fill the New entry dialog: the page's own name (`pageTitle`), its description,
 * the dates its text gives (`findDates`) and the section its words suggest. A page that cannot be read gives empty fields and a
 * one-line notice; the link is kept either way. One request to the public address the user pasted, with no identifiers.
 */
export async function readEntryLink(
  rawUrl: string,
  fetcher: Fetcher,
  today: string
): Promise<EntryLinkRead> {
  const url = validSourceUrl(rawUrl)
  let html: string
  try {
    const response = await fetcher(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5'
      }
    })
    if (response.status < 200 || response.status >= 300) throw statusError(response.status)
    html = await response.text()
  } catch (error) {
    return EMPTY(url, `Couldn’t read that page: ${describeFetchError(error)}`)
  }
  const title = pageTitle(html)
  const summary = meta(html, ['og:description', 'description', 'twitter:description']).slice(0, 300)
  const body = textOf(mainContent(html))
  const found = findDates(`${summary}\n${body}`, today)
  if (!title) return { ...EMPTY(url, 'Couldn’t find a title on that page'), summary }
  return {
    url,
    title,
    summary,
    section: sectionOf(title, `${summary}\n${body.slice(0, 600)}`),
    eventDate: found.eventStart,
    eventEnd: found.eventEnd,
    deadline: found.deadline,
    deadlineLabel: found.deadlineLabel,
    notice: null
  }
}
