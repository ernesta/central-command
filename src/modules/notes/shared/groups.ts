import { fold } from '@shared/text'
import type { NoteIndexRow } from './types'

/** Two levels at most: a group, and inside it a subgroup. Shown as "Thesis › Methods", never with slashes. */
export const GROUP_ARROW = '›'

/** How many groups the landing page shows as cards; the rest sit behind "Show all". */
export const LANDING_GROUP_LIMIT = 6

/** A group or subgroup name as it is stored: spaces collapsed and trimmed. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

/** Names compare ignoring case, accents and spacing, so "thesis" is not a second group next to "Thesis". */
export function nameKey(name: string): string {
  return fold(cleanName(name))
}

/** Slashes and the arrow are how nesting is written elsewhere, so a name may not contain them. */
export function isValidName(name: string): boolean {
  const clean = cleanName(name)
  return clean !== '' && !/[/\\›]/.test(clean) && clean.length <= 60
}

/** "Thesis", or "Thesis › Methods"; '' for an ungrouped note. */
export function groupLabel(group: string, subgroup = ''): string {
  if (!group) return ''
  return subgroup ? `${group} ${GROUP_ARROW} ${subgroup}` : group
}

type Grouped = Pick<NoteIndexRow, 'group' | 'subgroup'>

/**
 * Give a group and subgroup the spelling the notes already use (the first one found wins), so typing
 * "thesis" files a note under "Thesis". Names that match nothing are kept as typed. A subgroup is
 * only matched inside its own group, and there is none without a group.
 */
export function resolveNames(
  rows: readonly Grouped[],
  group: string,
  subgroup: string
): { group: string; subgroup: string } {
  const g = cleanName(group)
  if (!g) return { group: '', subgroup: '' }
  const gKey = nameKey(g)
  const inGroup = rows.filter((r) => r.group && nameKey(r.group) === gKey)
  const groupName = inGroup[0]?.group ?? g
  const s = cleanName(subgroup)
  if (!s) return { group: groupName, subgroup: '' }
  const sKey = nameKey(s)
  const sub = inGroup.find((r) => r.subgroup && nameKey(r.subgroup) === sKey)
  return { group: groupName, subgroup: sub?.subgroup ?? s }
}

export interface SubgroupSummary {
  name: string
  count: number
}

export interface GroupSummary {
  name: string
  /** Notes in the group, including those in its subgroups. */
  count: number
  /** The latest edit among them (milliseconds). */
  edited: number
  /** Subgroups by name. */
  subgroups: SubgroupSummary[]
}

/** The groups the notes use, by name. A group exists only while a note uses it. */
export function deriveGroups(rows: readonly (Grouped & { edited?: number })[]): GroupSummary[] {
  const groups = new Map<string, GroupSummary>()
  const subs = new Map<string, Map<string, SubgroupSummary>>()
  for (const row of rows) {
    const group = cleanName(row.group)
    if (!group) continue
    const key = nameKey(group)
    let summary = groups.get(key)
    if (!summary) {
      summary = { name: group, count: 0, edited: 0, subgroups: [] }
      groups.set(key, summary)
      subs.set(key, new Map())
    }
    summary.count++
    summary.edited = Math.max(summary.edited, row.edited ?? 0)
    const sub = cleanName(row.subgroup)
    if (sub) {
      const bySub = subs.get(key) as Map<string, SubgroupSummary>
      const subKey = nameKey(sub)
      const entry = bySub.get(subKey) ?? { name: sub, count: 0 }
      entry.count++
      bySub.set(subKey, entry)
    }
  }
  for (const [key, summary] of groups) {
    summary.subgroups = [...(subs.get(key) as Map<string, SubgroupSummary>).values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Which notes a list shows: all of them, the ungrouped ones, or one group (with all its subgroups) or one subgroup. */
export type GroupFilter =
  { scope: 'all' } | { scope: 'ungrouped' } | { scope: 'group'; group: string; subgroup: string }

export const ALL_GROUPS: GroupFilter = { scope: 'all' }

/** Choosing a group includes its subgroups; choosing a subgroup shows only that one. */
export function matchesGroup(row: Grouped, filter: GroupFilter): boolean {
  if (filter.scope === 'all') return true
  if (filter.scope === 'ungrouped') return !cleanName(row.group)
  if (nameKey(row.group) !== nameKey(filter.group)) return false
  return !filter.subgroup || nameKey(row.subgroup) === nameKey(filter.subgroup)
}

export function sameFilter(a: GroupFilter, b: GroupFilter): boolean {
  if (a.scope !== 'group' || b.scope !== 'group') return a.scope === b.scope
  return nameKey(a.group) === nameKey(b.group) && nameKey(a.subgroup) === nameKey(b.subgroup)
}

/** The page title for a filter: the group's label, "Ungrouped", or null when nothing is filtered. */
export function filterTitle(filter: GroupFilter): string | null {
  if (filter.scope === 'all') return null
  if (filter.scope === 'ungrouped') return 'Ungrouped'
  return groupLabel(filter.group, filter.subgroup)
}

export interface GroupOption {
  label: string
  filter: GroupFilter
  /** 0 for a group, 1 for a subgroup (indented in the selector). */
  depth: 0 | 1
  count: number
}

/** The choices for a group selector: every group followed by its subgroups. */
export function groupOptions(groups: readonly GroupSummary[]): GroupOption[] {
  return groups.flatMap((g) => [
    {
      label: g.name,
      filter: { scope: 'group', group: g.name, subgroup: '' } as GroupFilter,
      depth: 0 as const,
      count: g.count
    },
    ...g.subgroups.map((s) => ({
      label: groupLabel(g.name, s.name),
      filter: { scope: 'group', group: g.name, subgroup: s.name } as GroupFilter,
      depth: 1 as const,
      count: s.count
    }))
  ])
}

/** Turn whatever was remembered (possibly hand-edited) into a valid filter. */
export function normaliseFilter(raw: unknown): GroupFilter {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  if (o.scope === 'ungrouped') return { scope: 'ungrouped' }
  if (o.scope === 'group' && typeof o.group === 'string' && cleanName(o.group)) {
    const subgroup = typeof o.subgroup === 'string' ? cleanName(o.subgroup) : ''
    return { scope: 'group', group: cleanName(o.group), subgroup }
  }
  return ALL_GROUPS
}

/** A remembered filter for a group or subgroup that no longer exists goes back to "all". */
export function reconcileFilter(filter: GroupFilter, groups: readonly GroupSummary[]): GroupFilter {
  if (filter.scope !== 'group') return filter
  const group = groups.find((g) => nameKey(g.name) === nameKey(filter.group))
  if (!group) return ALL_GROUPS
  if (!filter.subgroup) return { scope: 'group', group: group.name, subgroup: '' }
  const sub = group.subgroups.find((s) => nameKey(s.name) === nameKey(filter.subgroup))
  return sub ? { scope: 'group', group: group.name, subgroup: sub.name } : ALL_GROUPS
}

export type LandingGroupCard =
  { kind: 'group'; group: GroupSummary } | { kind: 'ungrouped'; count: number; edited: number }

export interface LandingGroups {
  /** At most `limit` cards: the most recently edited groups, with Ungrouped last (and always there when any note is ungrouped). */
  cards: LandingGroupCard[]
  /** The rest, most recently edited first, for the "Show all" row. */
  more: GroupSummary[]
}

/** The landing page's groups: the six most recently edited as cards, the rest behind "Show all". */
export function landingGroups(
  rows: readonly NoteIndexRow[],
  limit = LANDING_GROUP_LIMIT
): LandingGroups {
  const ungrouped = rows.filter((r) => !cleanName(r.group))
  const byRecent = deriveGroups(rows).sort(
    (a, b) => b.edited - a.edited || a.name.localeCompare(b.name)
  )
  const slots = ungrouped.length > 0 ? limit - 1 : limit
  const cards: LandingGroupCard[] = byRecent
    .slice(0, slots)
    .map((group) => ({ kind: 'group', group }))
  if (ungrouped.length > 0) {
    cards.push({
      kind: 'ungrouped',
      count: ungrouped.length,
      edited: Math.max(...ungrouped.map((r) => r.edited))
    })
  }
  return { cards, more: byRecent.slice(slots) }
}
