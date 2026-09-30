/** A named link on a person's own page (Google Scholar, GitHub, a website…), or their own label. */
export interface PersonLink {
  label: string
  url: string
}

/** A person from the people list. Initials are unique (case-insensitively), archived people's included. */
export interface Person {
  name: string
  initials: string
  /** The user themselves; at most one. */
  me: boolean
  /**
   * Archived people are no longer offered when adding people to a note, but their name and initials still
   * resolve in old notes and their initials stay reserved.
   */
  archived?: boolean
  /** Shown on their own page. Empty or omitted for most people. */
  links?: PersonLink[]
}

/** Only http(s) is ever saved: the same rule `main/urls.ts` enforces before actually opening a link. */
export function isSafeLinkUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** Thrown for a change the people list refuses (blank name, duplicate name or initials, unknown person). */
export class PeopleError extends Error {}

const TITLES = new Set(['prof', 'professor', 'dr', 'mr', 'mrs', 'ms', 'miss', 'mx', 'sir', 'dame'])
const INITIALS = /^[\p{L}\p{N}]{1,6}$/u

const key = (initials: string): string => initials.toUpperCase()

function nameWords(name: string): string[] {
  return name
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter((w) => w !== '' && !TITLES.has(w.replace(/\.$/, '').toLowerCase()))
}

const first = (word: string): string => Array.from(word)[0].toUpperCase()

/**
 * Initials for a name: the first letters of the first and last words, ignoring titles ("Prof Kathy Rastle" gives
 * KR). A hyphenated last name gives a letter for each part ("Roger Giner-Sorolla" gives RGS).
 */
export function deriveInitials(name: string): string {
  const words = nameWords(name)
  if (words.length === 0) return ''
  if (words.length === 1) return first(words[0])
  const last = words[words.length - 1].split('-').filter((part) => part !== '')
  return [words[0], ...last].map(first).join('')
}

/**
 * Initials for a new person that no one else has: the usual ones if free, otherwise better ones rather than a
 * number: the capitals inside the last name ("Ryan McKay" gives RMK), the middle names, then more letters of the
 * last name. A number is the last resort.
 */
export function suggestInitials(name: string, taken: Iterable<string>): string {
  const base = deriveInitials(name)
  if (!base) return ''
  const used = new Set([...taken].map(key))
  const words = nameWords(name)
  const candidates: string[] = []
  if (words.length > 1) {
    const last = words[words.length - 1]
    const head = first(words[0])
    const capitals = Array.from(last)
      .filter((c, i) => i > 0 && c !== c.toLowerCase() && c === c.toUpperCase())
      .join('')
    if (capitals) candidates.push(`${head}${first(last)}${capitals}`.toUpperCase())
    const middle = words.slice(1, -1).map(first).join('')
    if (middle) candidates.push(`${head}${middle}${deriveInitials(`x ${last}`).slice(1)}`)
    const letters = Array.from(last.replace(/-/g, '')).map((c) => c.toUpperCase())
    for (let n = 2; n <= letters.length; n++)
      candidates.push(`${head}${letters.slice(0, n).join('')}`)
  }
  for (const candidate of [base, ...candidates]) {
    if (isValidInitials(candidate) && !used.has(key(candidate))) return candidate
  }
  return makeInitialsUnique(base, taken)
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
    initials = suggestInitials(
      name,
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
  /** Replaces the whole list. A link with an unsafe URL (anything but http/https) is refused. */
  links?: PersonLink[]
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
  let links = target.links
  if (patch.links !== undefined) {
    links = patch.links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label !== '' || l.url !== '')
    for (const l of links) {
      if (l.label === '') throw new PeopleError('A link needs a label')
      if (!isSafeLinkUrl(l.url)) throw new PeopleError(`"${l.url}" is not a web address`)
    }
  }
  const updated: Person = { ...target, name: newName, initials, me, links }
  const list = people.map((p) => (p === target ? updated : { ...p }))
  return withMe(list, initials, me)
}

/** A new list without the person called `name`. Files that mention them keep the name; nothing else is touched. */
export function removePerson(people: readonly Person[], name: string): Person[] {
  const target = findByName(people, name)
  if (!target) throw new PeopleError(`${name} is not in the list`)
  return people.filter((p) => p !== target).map((p) => ({ ...p }))
}

/** A new list in the order the People page shows: you first, then everyone else alphabetically by name. */
export const sortPeople = (people: readonly Person[]): Person[] =>
  [...people].sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name))

/** Everyone who is not archived: who can be added to a note. */
export const activePeople = (people: readonly Person[]): Person[] =>
  people.filter((p) => !p.archived)

/** A new list with the person called `name` archived (an archived person cannot be "me"). */
export function archivePerson(people: readonly Person[], name: string): Person[] {
  const target = findByName(people, name)
  if (!target) throw new PeopleError(`${name} is not in the list`)
  return people.map((p) => (p === target ? { ...p, me: false, archived: true } : { ...p }))
}

/** A new list with the person called `name` no longer archived. */
export function restorePerson(people: readonly Person[], name: string): Person[] {
  const target = findByName(people, name)
  if (!target) throw new PeopleError(`${name} is not in the list`)
  return people.map((p) => {
    if (p !== target) return { ...p }
    const active = { ...p }
    delete active.archived
    return active
  })
}

/** A new list without `from`, whose place in the notes `into` takes over (including being "me"). */
export function mergePerson(people: readonly Person[], from: string, into: string): Person[] {
  const source = findByName(people, from)
  const target = findByName(people, into)
  if (!source) throw new PeopleError(`${from} is not in the list`)
  if (!target) throw new PeopleError(`${into} is not in the list`)
  if (source === target) throw new PeopleError('Choose someone else to merge into')
  if (target.archived) throw new PeopleError(`${target.name} is archived`)
  return people
    .filter((p) => p !== source)
    .map((p) => (p === target ? { ...p, me: p.me || source.me } : { ...p }))
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
    const archived = o.archived === true
    const rawLinks = Array.isArray(o.links) ? o.links : []
    const links = rawLinks
      .filter(
        (l): l is { label: unknown; url: unknown } =>
          !!l && typeof l === 'object' && typeof (l as Record<string, unknown>).url === 'string'
      )
      .map((l) => ({
        label: typeof l.label === 'string' ? l.label.trim() : '',
        url: (l.url as string).trim()
      }))
      .filter((l) => l.label !== '' && isSafeLinkUrl(l.url))
    out.push({
      name,
      initials,
      me: o.me === true && !archived && !out.some((p) => p.me),
      ...(archived ? { archived } : {}),
      ...(links.length > 0 ? { links } : {})
    })
  }
  return out
}

export interface OwnerOption {
  initials: string
  name: string
  /** True for people at this meeting, who are suggested first. */
  attendee: boolean
}

/** Who a TODO can be assigned to: the meeting's attendees first, then everyone else in the list. */
export function ownerOptions(
  attendeeNames: readonly string[],
  people: readonly Person[]
): OwnerOption[] {
  const attendees = attendeeNames
    .map((name) => findByName(people, name))
    .filter((p): p is Person => p !== undefined)
  const seen = new Set<string>()
  const unique = attendees.filter(
    (p) => !seen.has(p.initials.toUpperCase()) && seen.add(p.initials.toUpperCase())
  )
  const others = activePeople(people).filter((p) => !seen.has(p.initials.toUpperCase()))
  return [
    ...unique.map((p) => ({ initials: p.initials, name: p.name, attendee: true })),
    ...others.map((p) => ({ initials: p.initials, name: p.name, attendee: false }))
  ]
}
