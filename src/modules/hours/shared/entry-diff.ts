import type { EntryParts } from '@shared/tracking/totals'
import type { TrackingYear } from '@shared/tracking/types'

/**
 * The sessions and typed time a change edited in place: those with the same id in both years but not the same. What an Undo needs
 * (`restoreEntries`) to put them back exactly, a trimmed neighbour and a merged row included. Blocks drawn from meeting notes
 * (`derived`, never saved) are left out.
 */
export function entryDiff(
  before: TrackingYear,
  after: TrackingYear
): { before: EntryParts; after: EntryParts } {
  const differing = <T extends { id: string }>(was: T[], now: T[]): { was: T[]; now: T[] } => {
    const out = { was: [] as T[], now: [] as T[] }
    for (const entry of now) {
      const old = was.find((e) => e.id === entry.id)
      if (old && JSON.stringify(old) !== JSON.stringify(entry)) {
        out.was.push(old)
        out.now.push(entry)
      }
    }
    return out
  }
  const sessions = differing(
    before.sessions.filter((s) => !s.derived),
    after.sessions.filter((s) => !s.derived)
  )
  const adjusts = differing(before.adjusts, after.adjusts)
  return {
    before: { sessions: sessions.was, adjusts: adjusts.was },
    after: { sessions: sessions.now, adjusts: adjusts.now }
  }
}
