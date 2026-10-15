import type { ParsedItem } from '../shared/types'
import { plainText } from './parse-feed'

interface CrossrefName {
  family?: string
  name?: string
}
interface CrossrefWork {
  DOI?: string
  URL?: string
  title?: string[]
  author?: CrossrefName[]
  'container-title'?: string[]
  abstract?: string
  created?: { 'date-time'?: string }
  type?: string
}

/** Crossref lists every deposit: keep articles, drop front matter and the like. */
const KEPT_TYPES = new Set(['journal-article', 'posted-content', 'proceedings-article'])

/** The newest works of a journal from `api.crossref.org/journals/<issn>/works`. Throws when the answer is not Crossref's. */
export function parseCrossref(json: string): ParsedItem[] {
  let data: { status?: string; message?: { items?: CrossrefWork[] } }
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Not Crossref JSON')
  }
  if (data.status !== 'ok' || !Array.isArray(data.message?.items))
    throw new Error('Unexpected Crossref answer')
  const items: ParsedItem[] = []
  for (const work of data.message.items) {
    const title = plainText(work.title?.[0] ?? '')
    const doi = work.DOI
    if (!title || !doi) continue
    if (work.type && !KEPT_TYPES.has(work.type)) continue
    const authors = (work.author ?? []).map((a) => a.family ?? a.name ?? '').filter(Boolean)
    const byline =
      authors.length > 3 ? `${authors.slice(0, 3).join(', ')} et al.` : authors.join(', ')
    const abstract = work.abstract ? plainText(work.abstract).replace(/^Abstract\s*/i, '') : ''
    items.push({
      key: doi.toLowerCase(),
      title,
      url: work.URL ?? `https://doi.org/${doi}`,
      summary: [byline, work['container-title']?.[0], abstract]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 1200),
      publishedAt: work.created?.['date-time'] ?? null
    })
  }
  return items
}

export function crossrefUrl(issn: string, rows = 25): string {
  const select = 'DOI,title,created,URL,author,container-title,abstract,type'
  return `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works?sort=created&order=desc&rows=${rows}&select=${select}`
}
