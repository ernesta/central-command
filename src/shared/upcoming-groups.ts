export interface UpcomingGroup<T> {
  key: 'upcoming' | 'earlier'
  label: 'Upcoming' | 'Earlier'
  rows: T[]
}

/**
 * A date-sorted list as an "Upcoming" group and an "Earlier" group, each in the list's own order. Undated rows are
 * upcoming (they have not happened) and come first in their group. A group with no rows is left out.
 */
export function groupByUpcoming<T extends { date: string }>(
  rows: readonly T[],
  isUpcoming: (row: T) => boolean
): UpcomingGroup<T>[] {
  const upcoming = rows.filter(isUpcoming)
  const groups: UpcomingGroup<T>[] = [
    {
      key: 'upcoming',
      label: 'Upcoming',
      rows: [...upcoming.filter((r) => r.date === ''), ...upcoming.filter((r) => r.date !== '')]
    },
    { key: 'earlier', label: 'Earlier', rows: rows.filter((r) => !isUpcoming(r)) }
  ]
  return groups.filter((g) => g.rows.length > 0)
}

export interface RowLayout<T> {
  /** The rows in the order a table draws them (and the keyboard walks them). */
  ordered: T[]
  /** What to draw: a group's header (null for an ungrouped list), its rows and where they start in `ordered`. */
  groups: { key: string; label: string | null; rows: T[]; start: number }[]
}

/**
 * How a table lays its rows out. Grouped only while the list is sorted by date, newest first (`grouped`); under any other
 * sort the headers go and the rows keep the order they were given.
 */
export function layoutRows<T extends { date: string }>(
  rows: readonly T[],
  grouped: boolean,
  isUpcoming: (row: T) => boolean
): RowLayout<T> {
  const parts = grouped
    ? groupByUpcoming(rows, isUpcoming).map((g) => ({
        key: g.key as string,
        label: g.label as string | null,
        rows: g.rows
      }))
    : [{ key: 'all', label: null as string | null, rows: [...rows] }]
  let start = 0
  const groups = parts.map((g) => {
    const placed = { ...g, start }
    start += g.rows.length
    return placed
  })
  return { ordered: groups.flatMap((g) => g.rows), groups }
}
