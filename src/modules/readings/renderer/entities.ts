import { BookOpen } from 'lucide-react'
import { modulePath } from '@modules/types'
import type { EntityProvider } from '@renderer/entities/registry'
import { DEFAULT_READINGS_QUERY } from '../shared/query'

const readingsBase = modulePath({ workspace: 'research', id: 'readings' })

/** Readings a note can mention: by citekey, which never changes once a reading is in Zotero. */
export const readingEntities: EntityProvider = {
  kind: 'reading',
  heading: 'Readings',
  noun: 'reading',
  icon: BookOpen,
  async search(query, limit) {
    const readings = await window.api.readings.list({ ...DEFAULT_READINGS_QUERY, search: query })
    return readings.slice(0, limit).map((reading) => ({
      id: reading.citekey,
      title: reading.fullTitle,
      detail: reading.shortCitation,
      label: reading.shortCitation,
      prepare: async () => ({ kind: 'reading' as const, key: reading.citekey })
    }))
  },
  async resolve(key) {
    const reading = await window.api.readings.get(key)
    if (!reading) return null
    return {
      title: reading.fullTitle,
      detail: reading.missingFromSource
        ? `${reading.shortCitation} · no longer in Zotero`
        : reading.shortCitation,
      route: `${readingsBase}/${encodeURIComponent(key)}`
    }
  }
}
