import { fold } from '@shared/text'
import type { Reading, ReadingStatus } from '../shared/types'
import type { ReadingSort, ReadingsQuery, TagCount } from '../shared/query'

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

export { fold }

function matchesSearch(reading: Reading, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = fold(
    [reading.shortCitation, reading.fullTitle, reading.tags.join(' '), reading.notesExcerpt].join(
      '\n'
    )
  )
  return terms.every((term) => haystack.includes(term))
}

const STATUS_ORDER: Record<ReadingStatus, number> = { to_read: 0, read: 1, unset: 2 }

function compareBy(sort: ReadingSort): (a: Reading, b: Reading) => number {
  const sign = sort.direction === 'asc' ? 1 : -1
  switch (sort.key) {
    case 'citation':
      return (a, b) => sign * collator.compare(a.shortCitation, b.shortCitation)
    case 'title':
      return (a, b) => sign * collator.compare(a.fullTitle, b.fullTitle)
    case 'status':
      return (a, b) => sign * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    case 'added':
      return (a, b) => sign * (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0)
    case 'updated':
      return (a, b) => sign * (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0)
    case 'year':
      // Readings without a year always sort last, whichever direction.
      return (a, b) => {
        if (a.year === null && b.year === null) return 0
        if (a.year === null) return 1
        if (b.year === null) return -1
        return sign * (a.year - b.year)
      }
  }
}

/** Filter and order readings. Pure: no database, so it is fast to test and reason about. */
export function queryReadings(readings: readonly Reading[], query: ReadingsQuery): Reading[] {
  const terms = fold(query.search).split(/\s+/).filter(Boolean)
  const wantedTags = query.tags.map(fold)
  const primary = compareBy(query.sort)

  return readings
    .filter((r) => !query.missingOnly || r.missingFromSource)
    .filter((r) => query.status === 'all' || r.status === query.status)
    .filter((r) => {
      if (wantedTags.length === 0) return true
      const have = new Set(r.tags.map(fold))
      return wantedTags.every((tag) => have.has(tag))
    })
    .filter((r) => matchesSearch(r, terms))
    .sort(
      (a, b) =>
        primary(a, b) ||
        collator.compare(a.shortCitation, b.shortCitation) ||
        collator.compare(a.citekey, b.citekey)
    )
}

/** Every tag with the number of readings using it, merging case variants under the first-seen spelling. */
export function collectTags(readings: readonly Reading[]): TagCount[] {
  const byKey = new Map<string, TagCount>()
  for (const reading of readings) {
    const seenHere = new Set<string>()
    for (const tag of reading.tags) {
      const key = fold(tag)
      if (seenHere.has(key)) continue
      seenHere.add(key)
      const entry = byKey.get(key)
      if (entry) entry.count++
      else byKey.set(key, { tag, count: 1 })
    }
  }
  return [...byKey.values()].sort((a, b) => collator.compare(a.tag, b.tag))
}
