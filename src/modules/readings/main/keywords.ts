import type { ReadingStatus } from '../shared/types'

const READ = new Set(['read'])
const TO_READ = new Set(['to-read', 'to read', 'toread'])

export interface MappedKeywords {
  status: ReadingStatus
  tags: string[]
}

/** Trim, drop empties and de-duplicate case-insensitively, keeping the first spelling and order. */
export function cleanKeywords(keywords: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of keywords) {
    const keyword = raw.trim()
    const key = keyword.toLowerCase()
    if (!keyword || seen.has(key)) continue
    seen.add(key)
    result.push(keyword)
  }
  return result
}

/**
 * Split Zotero keywords into a status and the remaining tags.
 * `read` beats `to-read` when both are present; the status keywords themselves
 * never appear as tags.
 */
export function mapKeywords(keywords: readonly string[]): MappedKeywords {
  const cleaned = cleanKeywords(keywords)
  const lower = cleaned.map((k) => k.toLowerCase())
  const isRead = lower.some((k) => READ.has(k))
  const isToRead = lower.some((k) => TO_READ.has(k))
  const status: ReadingStatus = isRead ? 'read' : isToRead ? 'to_read' : 'unset'
  const tags = cleaned.filter((_, i) => !READ.has(lower[i]) && !TO_READ.has(lower[i]))
  return { status, tags }
}
