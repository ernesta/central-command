import type { Author } from '../shared/types'

interface RawCreator {
  name?: string
  lastName?: string
  firstName?: string
  prefix?: string
}

export interface CreatorList {
  authors: Author[]
  /** The source ended the list with "and others". */
  etAl: boolean
}

/** The parser emits decomposed accents (u + combining mark); composed form searches and sorts correctly. */
export const nfc = (text: string): string => text.normalize('NFC')

export function toCreatorList(raw: unknown): CreatorList {
  const authors: Author[] = []
  let etAl = false
  if (!Array.isArray(raw)) return { authors, etAl }
  for (const creator of raw as RawCreator[]) {
    if (creator.name) {
      authors.push({ literal: nfc(creator.name.trim()) })
    } else if (creator.lastName === 'others' && !creator.firstName) {
      etAl = true
    } else if (creator.lastName) {
      const family = nfc([creator.prefix, creator.lastName].filter(Boolean).join(' ').trim())
      const given = creator.firstName ? nfc(creator.firstName.trim()) : undefined
      authors.push(given ? { family, given } : { family })
    }
  }
  return { authors, etAl }
}

export function toYear(...candidates: unknown[]): number | null {
  for (const value of candidates) {
    if (typeof value !== 'string') continue
    const match = value.match(/^\s*(\d{4})/)
    if (match) return Number(match[1])
  }
  return null
}

export function toKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((k) => nfc(String(k)))
  if (typeof value === 'string') return value.split(',').map(nfc)
  return []
}

export function toText(value: unknown): string {
  return typeof value === 'string' ? nfc(value.replace(/\s+/g, ' ').trim()) : ''
}
