import type { Person } from './types'

/** Thrown for a change the people list refuses (blank name, duplicate name or initials, unknown person). */
export class PeopleError extends Error {}

const TITLES = new Set(['prof', 'professor', 'dr', 'mr', 'mrs', 'ms', 'miss', 'mx', 'sir', 'dame'])
const INITIALS = /^[\p{L}\p{N}]{1,6}$/u

const key = (initials: string): string => initials.toUpperCase()

/** Initials for a name: the first letters of the first and last words, ignoring titles ("Prof Kathy Rastle" gives KR). */
export function deriveInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter((w) => w !== '' && !TITLES.has(w.replace(/\.$/, '').toLowerCase()))
  if (words.length === 0) return ''
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]]
  return letters.map((w) => Array.from(w)[0].toUpperCase()).join('')
}

/** `base` if free, otherwise `base2`, `base3`, … Comparison ignores case. */
export function makeInitialsUnique(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map(key))
  if (!used.has(key(base))) return base
  for (let n = 2; ; n++) {
    if (!used.has(key(`${base}${n}`))) return `${base}${n}`
  }
}

export function isValidInitials(value: string): boolean {
  return INITIALS.test(value)
}

export function findByInitials(people: readonly Person[], initials: string): Person | undefined {
  return people.find((p) => key(p.initials) === key(initials.trim()))
}

export function findByName(people: readonly Person[], name: string): Person | undefined {
  const wanted = name.trim().toLowerCase()
  return people.find((p) => p.name.toLowerCase() === wanted)
}

export interface NewPerson {
  name: string
  /** Derived from the name (and made unique) when omitted. */
  initials?: string
  me?: boolean
}

/** Setting `me` on one person clears it from everyone else. */
function withMe(people: Person[], initials: string, me: boolean): Person[] {
  if (!me) return people
  return people.map((p) => ({ ...p, me: key(p.initials) === key(initials) }))
}

/** A new list with `person` added. Never edits the input. */
export function addPerson(people: readonly Person[], input: NewPerson): Person[] {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new PeopleError('A person needs a name')
  if (findByName(people, name)) throw new PeopleError(`${name} is already in the list`)

  let initials: string
  if (input.initials !== undefined && input.initials.trim() !== '') {
    initials = input.initials.trim().toUpperCase()
    if (!isValidInitials(initials))
      throw new PeopleError(`"${input.initials}" is not valid initials`)
    if (findByInitials(people, initials)) {
      throw new PeopleError(
        `The initials ${initials} are already used by ${findByInitials(people, initials)!.name}`
      )
    }
  } else {
    const base = deriveInitials(name)
    if (!base) throw new PeopleError('Could not work out initials from that name')
    initials = makeInitialsUnique(
      base,
      people.map((p) => p.initials)
    )
  }
  const added: Person = { name, initials, me: false }
  return withMe([...people, added], initials, input.me === true)
}

export interface PersonPatch {
  name?: string
  initials?: string
  me?: boolean
}

/** A new list with the person called `name` changed. Initials must stay unique. */
export function updatePerson(
  people: readonly Person[],
  name: string,
  patch: PersonPatch
): Person[] {
  const target = findByName(people, name)
  if (!target) throw new PeopleError(`${name} is not in the list`)
  const others = people.filter((p) => p !== target)

  let newName = target.name
  if (patch.name !== undefined) {
    newName = patch.name.trim().replace(/\s+/g, ' ')
    if (!newName) throw new PeopleError('A person needs a name')
    if (findByName(others, newName)) throw new PeopleError(`${newName} is already in the list`)
  }
  let initials = target.initials
  if (patch.initials !== undefined) {
    initials = patch.initials.trim().toUpperCase()
    if (!isValidInitials(initials))
      throw new PeopleError(`"${patch.initials}" is not valid initials`)
    const clash = findByInitials(others, initials)
    if (clash) throw new PeopleError(`The initials ${initials} are already used by ${clash.name}`)
  }
  const me = patch.me ?? target.me
  const updated: Person = { name: newName, initials, me }
  const list = people.map((p) => (p === target ? updated : { ...p }))
  return withMe(list, initials, me)
}

/**
 * Turn whatever was read from `people.json` into a valid list. Entries that are not objects with a
 * name are skipped; clashing initials are made unique rather than dropping anyone; only the first
 * `me` counts.
 */
export function normalisePeople(raw: unknown): Person[] {
  const list =
    raw && typeof raw === 'object' && Array.isArray((raw as { people?: unknown }).people)
      ? ((raw as { people: unknown[] }).people as unknown[])
      : []
  const out: Person[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim().replace(/\s+/g, ' ') : ''
    if (!name || findByName(out, name)) continue
    const given = typeof o.initials === 'string' ? o.initials.trim().toUpperCase() : ''
    const base = isValidInitials(given) ? given : deriveInitials(name) || 'X'
    const initials = makeInitialsUnique(
      base,
      out.map((p) => p.initials)
    )
    out.push({ name, initials, me: o.me === true && !out.some((p) => p.me) })
  }
  return out
}
