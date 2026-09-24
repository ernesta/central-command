import type { ReadingSort, SortKey } from './query'

export interface SortPreset {
  value: string
  label: string
  sort: ReadingSort
}

export const SORT_PRESETS: readonly SortPreset[] = [
  { value: 'year:desc', label: 'Year (newest)', sort: { key: 'year', direction: 'desc' } },
  { value: 'year:asc', label: 'Year (oldest)', sort: { key: 'year', direction: 'asc' } },
  { value: 'citation:asc', label: 'Author A–Z', sort: { key: 'citation', direction: 'asc' } },
  { value: 'added:desc', label: 'Recently added', sort: { key: 'added', direction: 'desc' } },
  { value: 'updated:desc', label: 'Recently updated', sort: { key: 'updated', direction: 'desc' } }
]

const COLUMN_NAMES: Record<SortKey, string> = {
  citation: 'Citation',
  title: 'Title',
  year: 'Year',
  status: 'Status',
  added: 'Recently added',
  updated: 'Recently updated'
}

export const sortValue = (sort: ReadingSort): string => `${sort.key}:${sort.direction}`

/** The preset for a sort, or a generated entry when it came from clicking a column header. */
export function sortOption(sort: ReadingSort): { value: string; label: string } {
  const preset = SORT_PRESETS.find((p) => p.value === sortValue(sort))
  if (preset) return preset
  const arrow = sort.direction === 'asc' ? '↑' : '↓'
  return { value: sortValue(sort), label: `${COLUMN_NAMES[sort.key]} ${arrow}` }
}

export function parseSortValue(value: string): ReadingSort | null {
  return SORT_PRESETS.find((p) => p.value === value)?.sort ?? null
}

/** Clicking a column header: toggle the direction if it is already sorted, else sort by it (year newest first). */
export function nextSort(current: ReadingSort, key: SortKey): ReadingSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key, direction: key === 'year' || key === 'added' || key === 'updated' ? 'desc' : 'asc' }
}
