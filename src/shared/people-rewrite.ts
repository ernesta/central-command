import type { Person } from './people'

/**
 * What changing or merging a person means for the note files: full names to swap in the structured
 * fields (meeting attendees, training leads), and initials to swap in TODO owners. Initial keys are
 * upper-case.
 */
export interface PersonChange {
  names: ReadonlyMap<string, string>
  initials: ReadonlyMap<string, string>
}

/** The change that turns `from` into `to` (a renamed person, or the person merged into `to`). */
export function personChange(
  from: Pick<Person, 'name' | 'initials'>,
  to: Pick<Person, 'name' | 'initials'>
): PersonChange {
  return {
    names: from.name === to.name ? new Map() : new Map([[from.name, to.name]]),
    initials:
      from.initials.toUpperCase() === to.initials.toUpperCase()
        ? new Map()
        : new Map([[from.initials.toUpperCase(), to.initials]])
  }
}

export const isNoChange = (change: PersonChange): boolean =>
  change.names.size === 0 && change.initials.size === 0

/**
 * A list of names with `names` applied (exact match), or null when nothing in it changes. A name that
 * ends up listed twice (a merge into someone already there) is kept once.
 */
export function renameInList(
  list: readonly string[],
  names: ReadonlyMap<string, string>
): string[] | null {
  if (!list.some((n) => names.has(n))) return null
  const out: string[] = []
  for (const name of list) {
    const next = names.get(name) ?? name
    if (!out.includes(next)) out.push(next)
  }
  return out
}

/** What rewriting the note files did: how many were changed, and which were left alone because they changed meanwhile. */
export interface RewriteReport {
  changed: number
  /** File names skipped because they were edited while the rewrite ran; nothing was written to them. */
  skipped: string[]
}
