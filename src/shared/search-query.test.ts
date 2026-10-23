import { describe, expect, it } from 'vitest'
import type { Person } from './people'
import {
  isSearch,
  type ParsedSearch,
  parseSearch,
  passesFilters,
  planSources,
  resolvePeople,
  workspaceFilter,
  type SearchFilter
} from './search-query'

const TODAY = '2026-10-19'
const parse = (raw: string): ParsedSearch => parseSearch(raw, TODAY)
const f = (name: SearchFilter['name'], value: string, negated = false): SearchFilter => ({
  name,
  value,
  negated
})

describe('parseSearch', () => {
  it('leaves plain words alone', () => {
    expect(parse('luminos  studentship')).toMatchObject({
      text: 'luminos studentship',
      phrases: [],
      filters: [],
      notices: []
    })
  })

  it('reads in: with the rest of the words (the original failed search)', () => {
    const parsed = parse('experiments in:task')
    expect(parsed.text).toBe('experiments')
    expect(parsed.filters).toEqual([f('in', 'task')])
    expect(parsed.notices).toEqual([])
  })

  it('ignores case in the name and the value, and accents', () => {
    expect(parse('In:Meetings').filters).toEqual([f('in', 'meetings')])
    expect(parse('workspace:Réséarch').filters).toEqual([f('workspace', 'research')])
  })

  it('takes a quoted value, and quoted phrases without a modifier', () => {
    const parsed = parse('status:"In Progress" "effect size" power')
    expect(parsed.filters).toEqual([f('status', 'in progress')])
    expect(parsed.phrases).toEqual(['effect size'])
    expect(parsed.text).toBe('power')
  })

  it('takes a minus in front of a modifier as exclusion', () => {
    expect(parse('-in:readings sample')).toMatchObject({
      text: 'sample',
      filters: [f('in', 'readings', true)]
    })
    expect(parse('-due:overdue').filters).toEqual([f('due', 'overdue', true)])
  })

  it('keeps an unknown name:value as text and says it is not a filter', () => {
    const parsed = parse('hello foo:bar')
    expect(parsed.text).toBe('hello foo:bar')
    expect(parsed.notices).toEqual(['Not a filter: foo:bar'])
  })

  it('does not take an address or a time for a modifier', () => {
    expect(parse('10:30 https://example.com').notices).toEqual([])
    expect(parse('10:30').text).toBe('10:30')
    expect(parse('https://example.com').notices).toEqual([])
  })

  it('names the accepted values for a value a modifier does not take, and leaves its text out', () => {
    const parsed = parse('x priority:1 in:progress')
    expect(parsed.text).toBe('x')
    expect(parsed.filters).toEqual([])
    expect(parsed.notices).toEqual([
      'priority: accepts P1, P2, P3',
      expect.stringContaining('in: accepts tasks, notes')
    ])
  })

  it('ignores a modifier typed with no value yet', () => {
    const parsed = parse('luminos in:')
    expect(parsed.filters).toEqual([])
    expect(parsed.notices).toEqual([])
    expect(parsed.text).toBe('luminos')
  })

  it('takes only the listed values: no abbreviations, no numbers', () => {
    expect(parse('in:tr').filters).toEqual([])
    expect(parse('priority:p1').filters).toEqual([f('priority', 'p1')])
    expect(parse('status:progress').filters).toEqual([])
    expect(parse('workspace:r').filters).toEqual([])
  })

  it('accepts only the dates it lists', () => {
    expect(parse('after:2026-05').filters).toEqual([f('after', '2026-05')])
    expect(parse('before:yesterday').filters).toHaveLength(1)
    expect(parse('on:Oct 3').filters).toEqual([])
    expect(parse('on:2026-02-30').filters).toEqual([])
    expect(parse('during:"this week"').filters).toEqual([f('during', 'this week')])
    expect(parse('during:2026-10-03').filters).toEqual([])
  })

  it('says "No item has two …" for two different values of a one-valued modifier', () => {
    const parsed = parse('in:tasks in:notes')
    expect(parsed.impossible).toBe(true)
    expect(parsed.notices).toEqual(['No item has two sources.'])
    expect(parse('status:done status:open').notices).toEqual(['No item has two statuses.'])
    expect(parse('priority:p1 priority:p2').notices).toEqual(['No item has two priorities.'])
    expect(parse('series:a series:b').impossible).toBe(true)
  })

  it('is fine with the same value twice, a negation, or a modifier an item can have several of', () => {
    expect(parse('in:task in:tasks').impossible).toBe(false)
    expect(parse('-in:notes -in:people').impossible).toBe(false)
    expect(parse('in:tasks -in:notes').impossible).toBe(false)
    expect(parse('tag:a tag:b with:x with:y').impossible).toBe(false)
    expect(parse('after:2026 before:2027').impossible).toBe(false)
  })
})

describe('isSearch', () => {
  const searched = (raw: string): boolean => isSearch(parse(raw))

  it('is false for an empty field and true for words, a phrase or a modifier with a value', () => {
    expect(searched('   ')).toBe(false)
    expect(searched('x')).toBe(true)
    expect(searched('"x y"')).toBe(true)
    expect(searched('in:notes')).toBe(true)
    expect(searched('-in:notes')).toBe(true)
  })

  it('lists what modifiers alone match', () => {
    expect(searched('in:meetings workspace:work')).toBe(true)
    expect(searched('before:2026-01')).toBe(true)
  })

  it('is false for a modifier with no value yet', () => {
    expect(searched('in:')).toBe(false)
    expect(searched('before:')).toBe(false)
    expect(searched('-tag:')).toBe(false)
    expect(searched('in:"')).toBe(false)
  })

  it('is false for an unknown modifier on its own, and true once there are real words beside it', () => {
    expect(searched('person:')).toBe(false)
    expect(searched('person:kathy')).toBe(false)
    expect(searched('person:kathy foo:bar')).toBe(false)
    expect(searched('person:kathy rastle')).toBe(true)
  })

  it('is false for a value the modifier does not accept, true with other words', () => {
    expect(searched('in:home')).toBe(false)
    expect(searched('workspace:elsewhere')).toBe(false)
    expect(searched('before:soon')).toBe(false)
    expect(searched('in:home sample')).toBe(true)
  })

  it('treats an address or a time as text', () => {
    expect(searched('https://example.org')).toBe(true)
    expect(searched('10:30')).toBe(true)
  })
})

describe('resolvePeople', () => {
  const people: Person[] = [
    { name: 'Chris Cummiskey', initials: 'CC', me: false },
    { name: 'Ernesta Orlovaitė', initials: 'EO', me: true }
  ]
  it('turns initials or a full name (any case) into the folded full name', () => {
    expect(resolvePeople(parse('with:cc by:"ernesta orlovaite"'), people).filters).toEqual([
      f('with', 'chris cummiskey'),
      f('by', 'ernesta orlovaite')
    ])
  })
  it('leaves out a name that is nobody in the list, with a notice', () => {
    const out = resolvePeople(parse('with:Chris'), people)
    expect(out.filters).toEqual([])
    expect(out.notices).toEqual(['with: needs a name or initials from the people list'])
  })
})

describe('planSources', () => {
  const sources = [
    { id: 'actions', workspace: null },
    { id: 'people', workspace: null },
    { id: 'readings', workspace: null },
    { id: 'notes', workspace: 'work' as const },
    { id: 'tasks', workspace: 'research' as const },
    { id: 'meetings', workspace: 'research' as const }
  ]
  const ids = (raw: string): string[] =>
    planSources(parse(raw), sources, TODAY).map((p) => p.source.id)

  it('searches everything when nothing narrows it', () => {
    expect(ids('x')).toHaveLength(6)
  })

  it('in: keeps only the source named, singular or plural', () => {
    expect(ids('in:task x')).toEqual(['tasks'])
    expect(ids('in:people')).toEqual(['people'])
  })

  it('-in: leaves the source out and keeps the rest', () => {
    expect(ids('-in:readings x')).toEqual(['actions', 'people', 'notes', 'tasks', 'meetings'])
    expect(ids('-in:readings -in:people')).not.toContain('people')
  })

  it('workspace: keeps that workspace and every source that has none', () => {
    expect(ids('workspace:work')).toEqual(['actions', 'people', 'readings', 'notes'])
    expect(ids('workspace:research')).toEqual([
      'actions',
      'people',
      'readings',
      'tasks',
      'meetings'
    ])
  })

  it('-workspace: leaves that workspace out and keeps the unscoped sources', () => {
    expect(ids('-workspace:research')).toEqual(['actions', 'people', 'readings', 'notes'])
  })

  it('narrows to the sources that have a positive modifier and take its value', () => {
    expect(ids('status:done')).toEqual(['tasks'])
    expect(ids('status:read')).toEqual(['readings'])
    expect(ids('status:"to read"')).toEqual(['readings'])
    expect(ids('priority:p1')).toEqual(['tasks'])
    expect(ids('has:summary')).toEqual(['meetings'])
  })

  it('never narrows for a negated modifier', () => {
    expect(ids('-priority:p1 x')).toHaveLength(6)
    expect(ids('-status:done x')).toHaveLength(6)
  })

  it('passes a source only the filters it has', () => {
    const plan = planSources(
      parse('in:tasks workspace:research priority:p1 -tag:x'),
      sources,
      TODAY
    )
    expect(plan).toHaveLength(1)
    expect(plan[0].filters).toEqual([f('priority', 'p1'), f('tag', 'x', true)])
  })

  it('ANDs different modifiers: in: and workspace: together', () => {
    expect(ids('in:notes workspace:research')).toEqual([])
    expect(ids('in:notes workspace:work')).toEqual(['notes'])
    expect(ids('in:people workspace:work')).toEqual(['people'])
  })
})

describe('passesFilters', () => {
  const test = (filter: SearchFilter): boolean => filter.value === 'yes'
  it('needs every positive filter to hold and every negated one not to', () => {
    expect(passesFilters([f('tag', 'yes'), f('tag', 'yes')], test)).toBe(true)
    expect(passesFilters([f('tag', 'yes'), f('tag', 'no')], test)).toBe(false)
    expect(passesFilters([f('tag', 'no', true)], test)).toBe(true)
    expect(passesFilters([f('tag', 'yes', true)], test)).toBe(false)
    expect(passesFilters([], test)).toBe(true)
  })
})

describe('new:', () => {
  it('asks to create a kind and is not a filter or a search', () => {
    const parsed = parse('new:task')
    expect(parsed.create?.kind).toBe('task')
    expect(parsed.filters).toEqual([])
    expect(isSearch(parsed)).toBe(false)
    for (const kind of ['note', 'task', 'meeting', 'training', 'reading-list'])
      expect(parse(`new:${kind}`).create?.kind).toBe(kind)
  })

  it('keeps workspace: beside it, and says what it accepts for another value', () => {
    expect(parse('new:meeting workspace:work').filters).toEqual([f('workspace', 'work')])
    expect(workspaceFilter(parse('new:meeting workspace:work'))).toBe('work')
    expect(workspaceFilter(parse('new:meeting'))).toBeNull()
    const bad = parse('new:person')
    expect(bad.create).toBeNull()
    expect(bad.notices[0]).toContain('new: accepts')
  })

  it('takes the plain words as the title and list:, due:, priority:, tag: as fields, not filters or notices', () => {
    const parsed = parse(
      'new:task Write the intro list:Training/Day-2 due:tomorrow priority:p1 tag:Draft tag:paper'
    )
    expect(parsed.create).toEqual({
      kind: 'task',
      title: 'Write the intro',
      list: 'Training',
      sublist: 'Day-2',
      due: '2026-10-20',
      priority: 'high',
      tags: ['Draft', 'paper']
    })
    expect(parsed.filters).toEqual([])
    expect(parsed.notices).toEqual([])
    expect(isSearch(parsed)).toBe(false)
    expect(parse('new:task due:week').create?.due).toBe('2026-10-25')
    expect(parse('new:task due:today').create?.due).toBe('2026-10-19')
  })

  it('refuses due:overdue and an unknown priority with a notice, and ignores them', () => {
    const parsed = parse('new:task x due:overdue priority:p9')
    expect(parsed.create?.due).toBeNull()
    expect(parsed.create?.priority).toBeNull()
    expect(parsed.notices).toEqual([
      'due: accepts today, tomorrow, week here',
      'priority: accepts P1, P2, P3'
    ])
  })

  it('leaves them filters when there is no new:', () => {
    const parsed = parse('words list:Training')
    expect(parsed.create).toBeNull()
    expect(parsed.filters).toEqual([f('list', 'training')])
  })

  it('cannot be excluded', () => {
    const parsed = parse('-new:task')
    expect(parsed.create).toBeNull()
    expect(parsed.notices).toEqual(['new: cannot be excluded'])
  })
})
