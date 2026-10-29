import type { Person } from './people'
import type { Workspace } from './settings'
import { fold } from './text'
import { todayIso } from './time'
import { addDays, dateMatches, parseDateRange, parsePeriod, type DayRange } from './search-dates'

/** Every place the global search can look, by the id its module (or the shell) registers. */
export const SOURCE_IDS = [
  'actions',
  'people',
  'tasks',
  'notes',
  'meetings',
  'training',
  'readings',
  'reading-lists',
  'watch'
] as const
export type SourceId = (typeof SOURCE_IDS)[number]

export const MODIFIER_NAMES = [
  'in',
  'workspace',
  'with',
  'by',
  'status',
  'priority',
  'due',
  'list',
  'tag',
  'skill',
  'series',
  'has',
  'before',
  'after',
  'on',
  'during',
  'new'
] as const
export type ModifierName = (typeof MODIFIER_NAMES)[number]

/** The sources `in:` names, singular or plural: the only forms there are. */
const IN_VALUES: Record<string, SourceId> = {
  task: 'tasks',
  tasks: 'tasks',
  note: 'notes',
  notes: 'notes',
  meeting: 'meetings',
  meetings: 'meetings',
  training: 'training',
  trainings: 'training',
  reading: 'readings',
  readings: 'readings',
  list: 'reading-lists',
  lists: 'reading-lists',
  person: 'people',
  people: 'people',
  watch: 'watch'
}

/** What `in:` is shown to accept (one form each; the singular works too). */
const IN_SHOWN = ['tasks', 'notes', 'meetings', 'training', 'readings', 'lists', 'people', 'watch']

/** What `new:` creates (Enter on the chip makes the empty thing and opens it): not a filter, no source has the field. */
export const NEW_VALUES = ['note', 'task', 'meeting', 'training', 'reading-list'] as const
export type NewKind = (typeof NEW_VALUES)[number]

export const WORKSPACE_VALUES: readonly Workspace[] = ['research', 'work', 'life']

/** What a source accepts for a modifier: a fixed list of folded values, any text (checked against the user's data later), or a date. */
type Spec = readonly string[] | 'any' | 'date' | 'period'

interface Modifier {
  /** Where each source stands: absent means the source does not have the field. */
  sources: Partial<Record<SourceId, Spec>>
  /** An item can only have one value, so two different ones can never match: "No item has two <noun>." */
  single?: string
  /** The value as it is compared, for the repeat check (`in:task` and `in:tasks` are one). */
  canon?: (folded: string) => string
}

const ALL: Partial<Record<SourceId, Spec>> = Object.fromEntries(
  SOURCE_IDS.map((id) => [id, 'any' as const])
)

export const MODIFIERS: Record<ModifierName, Modifier> = {
  in: { sources: ALL, single: 'sources', canon: (v) => IN_VALUES[v] ?? v },
  workspace: { sources: ALL, single: 'workspaces' },
  with: { sources: { notes: 'any', meetings: 'any', training: 'any', readings: 'any' } },
  by: { sources: { readings: 'any', training: 'any' } },
  status: {
    sources: {
      tasks: ['to do', 'in progress', 'done', 'open'],
      readings: ['read', 'to read']
    },
    single: 'statuses'
  },
  priority: { sources: { tasks: ['p1', 'p2', 'p3'] }, single: 'priorities' },
  due: { sources: { tasks: ['today', 'tomorrow', 'overdue', 'week'] }, single: 'due dates' },
  list: { sources: { tasks: 'any' }, single: 'lists' },
  tag: { sources: { tasks: 'any', readings: 'any' } },
  skill: { sources: { training: 'any', meetings: 'any' } },
  series: { sources: { meetings: 'any', training: 'any' }, single: 'series' },
  has: {
    sources: { tasks: ['due', 'description'], readings: ['notes'], meetings: ['todos', 'summary'] }
  },
  before: { sources: DATED() },
  after: { sources: DATED() },
  on: { sources: DATED(), single: 'days' },
  during: { sources: DATED('period'), single: 'periods' },
  new: { sources: {}, single: 'things to create' }
}

function DATED(spec: Spec = 'date'): Partial<Record<SourceId, Spec>> {
  return { notes: spec, meetings: spec, training: spec, tasks: spec, readings: spec, watch: spec }
}

export interface SearchFilter {
  name: ModifierName
  /** Folded (case and accents ignored); `with:` and `by:` hold the person's folded full name once resolved. */
  value: string
  negated: boolean
}

export interface ParsedSearch {
  /** The plain words, joined by spaces. */
  text: string
  /** Quoted phrases, without the quotes. */
  phrases: string[]
  filters: SearchFilter[]
  /** How many of the words are plain text: an unknown `name:value` is in `text` but is not something to search for. */
  plainWords: number
  /** Short lines to show above the results. */
  notices: string[]
  /** Two different values of a single-valued modifier: nothing can match. */
  impossible: boolean
  /** What a `new:` word asks to create, with what else the query says; null when there is none. It is not a search, so none of it is in `filters`. */
  create: CreateRequest | null
}

/** A `new:<kind>` query: the plain words are the title, and `list:`, `due:`, `priority:` and `tag:` fill a task in instead of filtering. */
export interface CreateRequest {
  kind: NewKind
  /** The plain words and quoted phrases, as typed; empty when there are none. */
  title: string
  /** As typed (`Training` or `Training/Day 2`): checked against the lists where the thing is made. */
  list: string
  sublist: string
  /** The date a `due:` word names (`today`, `tomorrow`, `week` is six days on); null when there is none. */
  due: string | null
  priority: 'high' | 'normal' | 'low' | null
  tags: string[]
}

/** What `due:` takes when it creates: a date to give, not a range to match (no `overdue`). */
const DUE_TO_CREATE = ['today', 'tomorrow', 'week']
const PRIORITY_TO_CREATE: Record<string, 'high' | 'normal' | 'low'> = {
  p1: 'high',
  p2: 'normal',
  p3: 'low'
}

/** What a source is asked: the parsed search with today's date, and only the filters it can apply. */
export interface SearchRequest extends ParsedSearch {
  today: string
}

/** A request for plain words, for tests and callers that have no modifiers. */
export function plainRequest(text: string): SearchRequest {
  return {
    text,
    phrases: [],
    filters: [],
    plainWords: text.split(/\s+/).filter(Boolean).length,
    notices: [],
    impossible: false,
    create: null,
    today: todayIso()
  }
}

/** A typed search as the request a source gets (`with:` and `by:` need the full name, since the people list is not read here). */
export function searchRequest(raw: string, today = todayIso()): SearchRequest {
  return { ...parseSearch(raw, today), today }
}

function isModifier(name: string): name is ModifierName {
  return (MODIFIER_NAMES as readonly string[]).includes(name)
}

/** Whether a folded value is one the modifier takes (for `in:` and `workspace:` the listed values, else any source's spec). */
export function valueAccepted(name: ModifierName, folded: string, today: string): boolean {
  if (name === 'in') return folded in IN_VALUES
  if (name === 'workspace') return (WORKSPACE_VALUES as readonly string[]).includes(folded)
  if (name === 'new') return (NEW_VALUES as readonly string[]).includes(folded)
  return Object.values(MODIFIERS[name].sources).some((spec) => specAccepts(spec, folded, today))
}

function specAccepts(spec: Spec, value: string, today: string): boolean {
  if (spec === 'any') return true
  if (spec === 'date') return parseDateRange(value, today) !== null
  if (spec === 'period') return parsePeriod(value, today) !== null
  return spec.includes(value)
}

/** Whether this source has the field and accepts this value for it. */
export function sourceAccepts(source: string, filter: SearchFilter, today: string): boolean {
  const spec = MODIFIERS[filter.name].sources[source as SourceId]
  return spec !== undefined && specAccepts(spec, filter.value, today)
}

/** The values a modifier is shown to accept, one form each, for notices and the completion list. Empty when it takes the user's own words. */
export function modifierValues(name: ModifierName): string[] {
  if (name === 'in') return [...IN_SHOWN]
  if (name === 'workspace') return [...WORKSPACE_VALUES]
  if (name === 'new') return [...NEW_VALUES]
  const lists = [...new Set(Object.values(MODIFIERS[name].sources).filter(Array.isArray).flat())]
  return name === 'priority' ? lists.map((v) => v.toUpperCase()) : lists
}

/** How a value is typed: quoted when it has spaces or is not a single plain word. */
export function quoteValue(value: string): string {
  return /^[^\s"]+$/.test(value) ? value : `"${value.replace(/"/g, '')}"`
}

function acceptedValues(name: ModifierName): string {
  const values = modifierValues(name)
  if (values.length > 0) return values.map(quoteValue).join(', ')
  if (Object.values(MODIFIERS[name].sources).includes('period'))
    return 'YYYY-MM, YYYY, today, yesterday, "this week", "last week", "this month", "last month", "this year", "last year"'
  return 'YYYY-MM-DD, YYYY-MM, YYYY, today, yesterday'
}

// A modifier (optional minus, name, colon, a value or a quoted value), a quoted phrase, or any other word.
const TOKEN = /(-?)([A-Za-z]+):(?:"([^"]*)"?|(\S*))|"([^"]*)"?|(\S+)/g

/**
 * Slack-style search syntax: plain words, `"exact phrases"`, and `name:value` modifiers (a value with spaces is quoted, a `-` in
 * front excludes). A name that is not a modifier stays in the text with a notice, a value a modifier does not accept is left
 * out with a notice saying what it accepts, and a modifier typed with no value yet is ignored. The people-list check for `with:`
 * and `by:` needs the list, so it is `resolvePeople`'s job.
 */
export function parseSearch(raw: string, today = todayIso()): ParsedSearch {
  const words: string[] = []
  const phrases: string[] = []
  const filters: SearchFilter[] = []
  const notices: string[] = []
  let kind: NewKind | null = null
  let unknown = 0
  // `new:` is looked for first: with it the words around it make the thing instead of searching.
  for (const match of raw.matchAll(TOKEN)) {
    const [, minus, rawName, quoted, bare] = match
    const value = fold(quoted ?? bare ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (minus !== '-' && rawName?.toLowerCase() === 'new' && valueAccepted('new', value, today))
      kind = value as NewKind
  }
  const made: Omit<CreateRequest, 'kind' | 'title'> = {
    list: '',
    sublist: '',
    due: null,
    priority: null,
    tags: []
  }
  for (const match of raw.matchAll(TOKEN)) {
    const [token, minus, rawName, quoted, bare, phrase, word] = match
    if (rawName !== undefined) {
      const name = rawName.toLowerCase()
      const value = quoted ?? bare ?? ''
      if (value.startsWith('//')) {
        words.push(token)
      } else if (!isModifier(name)) {
        words.push(token)
        unknown++
        notices.push(`Not a filter: ${token}`)
      } else if (value.trim() !== '') {
        const folded = fold(value).replace(/\s+/g, ' ').trim()
        if (name === 'new' && minus === '-') notices.push('new: cannot be excluded')
        else if (name === 'new' && valueAccepted(name, folded, today)) continue
        else if (
          kind &&
          minus !== '-' &&
          (name === 'list' || name === 'due' || name === 'priority' || name === 'tag')
        ) {
          if (name === 'list') {
            const [list, ...rest] = value.split('/')
            made.list = list.trim()
            made.sublist = rest.join('/').trim()
          } else if (name === 'tag') {
            made.tags.push(value.trim())
          } else if (name === 'due') {
            if (!DUE_TO_CREATE.includes(folded))
              notices.push(`due: accepts ${DUE_TO_CREATE.join(', ')} here`)
            else
              made.due = folded === 'today' ? today : addDays(today, folded === 'tomorrow' ? 1 : 6)
          } else if (PRIORITY_TO_CREATE[folded]) {
            made.priority = PRIORITY_TO_CREATE[folded]
          } else {
            notices.push('priority: accepts P1, P2, P3')
          }
        } else if (valueAccepted(name, folded, today))
          filters.push({ name, value: folded, negated: minus === '-' })
        else notices.push(`${name}: accepts ${acceptedValues(name)}`)
      }
    } else if (phrase !== undefined) {
      if (phrase.trim() !== '') phrases.push(phrase.trim())
    } else if (word !== undefined) {
      words.push(word)
    }
  }
  const repeated = MODIFIER_NAMES.filter((name) => {
    const single = MODIFIERS[name].single
    if (!single) return false
    const canon = MODIFIERS[name].canon ?? ((v: string) => v)
    return (
      new Set(filters.filter((f) => f.name === name && !f.negated).map((f) => canon(f.value)))
        .size > 1
    )
  })
  for (const name of repeated) notices.push(`No item has two ${MODIFIERS[name].single}.`)
  return {
    text: words.join(' '),
    phrases,
    filters,
    plainWords: words.length - unknown,
    notices,
    impossible: repeated.length > 0,
    create: kind ? { kind, title: [...words, ...phrases].join(' ').trim(), ...made } : null
  }
}

/**
 * Whether the query is a search at all: it has plain words, a phrase, or a modifier with an accepted value. A modifier with no
 * value yet (`in:`), an unknown one (`person:`) and a known one with a value it does not take (`in:home`) are not: they get their
 * help or notice instead of "No results.".
 */
export function isSearch(parsed: ParsedSearch): boolean {
  // `new:` makes something; the words with it are its title, not a search.
  if (parsed.create) return false
  return parsed.plainWords > 0 || parsed.phrases.length > 0 || parsed.filters.length > 0
}

/** The workspace a `workspace:` filter names, if the search has a positive one (it overrides the page's for `new:`). */
export function workspaceFilter(parsed: ParsedSearch): Workspace | null {
  const f = parsed.filters.find((x) => x.name === 'workspace' && !x.negated)
  return f ? (f.value as Workspace) : null
}

/** The person a `with:` or `by:` value names: a full name or initials, case and accents ignored. */
export function findPerson(people: readonly Person[], folded: string): Person | undefined {
  return (
    people.find((p) => fold(p.name) === folded) ?? people.find((p) => fold(p.initials) === folded)
  )
}

/** Replace each `with:` and `by:` value by the person's folded full name; one that is nobody in the list is left out, with a notice. */
export function resolvePeople(parsed: ParsedSearch, people: readonly Person[]): ParsedSearch {
  const notices = [...parsed.notices]
  const filters = parsed.filters.flatMap((f): SearchFilter[] => {
    if (f.name !== 'with' && f.name !== 'by') return [f]
    const person = findPerson(people, f.value)
    if (person) return [{ ...f, value: fold(person.name) }]
    notices.push(`${f.name}: needs a name or initials from the people list`)
    return []
  })
  return { ...parsed, filters, notices }
}

/** One place to search, as the planner sees it. */
export interface PlannedSource {
  id: string
  /** The workspace its items belong to; null when they belong to none (people, readings, commands). */
  workspace: Workspace | null
}

/**
 * The sources a search looks in and the filters each is given. `in:` and `workspace:` are settled here: `in:` names the
 * sources, `workspace:` keeps a workspace's own sources and every source that has no workspace. Any other positive modifier
 * leaves out a source that lacks the field (or does not take the value); a negated one never narrows, since an item without
 * the field is not matched by it.
 */
export function planSources<T extends PlannedSource>(
  parsed: ParsedSearch,
  sources: readonly T[],
  today = todayIso()
): { source: T; filters: SearchFilter[] }[] {
  const plan: { source: T; filters: SearchFilter[] }[] = []
  for (const source of sources) {
    let keep = true
    const filters: SearchFilter[] = []
    for (const f of parsed.filters) {
      if (f.name === 'in') {
        const named = (IN_VALUES[f.value] ?? f.value) === source.id
        if (f.negated ? named : !named) keep = false
      } else if (f.name === 'workspace') {
        if (source.workspace !== null) {
          const same = source.workspace === f.value
          if (f.negated ? same : !same) keep = false
        }
      } else if (sourceAccepts(source.id, f, today)) {
        filters.push(f)
      } else if (!f.negated) {
        keep = false
      }
    }
    if (keep) plan.push({ source, filters })
  }
  return plan
}

/** `test` for each filter, negated ones inverted: true when the item passes them all. */
export function passesFilters(
  filters: readonly SearchFilter[],
  test: (filter: SearchFilter) => boolean
): boolean {
  return filters.every((f) => (f.negated ? !test(f) : test(f)))
}

/** Whether an item dated `item` passes a `before:`, `after:`, `on:` or `during:` filter (before negation). */
export function dateFilterMatches(
  filter: SearchFilter,
  today: string,
  item: DayRange | null
): boolean {
  if (
    filter.name !== 'before' &&
    filter.name !== 'after' &&
    filter.name !== 'on' &&
    filter.name !== 'during'
  )
    return false
  const range =
    filter.name === 'during'
      ? parsePeriod(filter.value, today)
      : parseDateRange(filter.value, today)
  return range !== null && dateMatches(filter.name, range, item)
}

/** Whether the folded text has every word and every phrase of the search. */
export function textMatches(
  folded: string,
  request: Pick<ParsedSearch, 'text' | 'phrases'>
): boolean {
  const words = fold(request.text).split(/\s+/).filter(Boolean)
  return (
    words.every((w) => folded.includes(w)) &&
    request.phrases.every((p) => folded.includes(fold(p).replace(/\s+/g, ' ')))
  )
}

/** The folded words and phrases to look for, for a snippet of the text around the first. */
export function searchNeedles(request: Pick<ParsedSearch, 'text' | 'phrases'>): string[] {
  return [
    ...fold(request.text).split(/\s+/).filter(Boolean),
    ...request.phrases.map((p) => fold(p).replace(/\s+/g, ' '))
  ]
}
