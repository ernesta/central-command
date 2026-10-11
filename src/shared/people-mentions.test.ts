import { describe, expect, it } from 'vitest'
import {
  applyPersonMentionsInProse,
  findPersonMentionsInProse,
  firstNameAliases,
  fullNameAliases,
  aliasesFor,
  peoplePresent,
  planPersonChips,
  scanPersonMentionsInProse,
  shortFormProblem,
  unchipPersonMentions,
  undoPersonMentionsInProse,
  workspaceOf,
  type PersonAlias
} from './people-mentions'

const people = [
  'Kathy Rastle',
  'Matthew Jukes',
  'Robert Darby',
  'Robert De Vries',
  'Caitlin Baron',
  'Caitlin Collis',
  'Thomas Ormerod'
]
const full = fullNameAliases(people)
const { aliases: firsts, ambiguous } = firstNameAliases(people)
const all: PersonAlias[] = [...full, ...firsts]
const link = (t: string, a: readonly PersonAlias[] = all): string =>
  applyPersonMentionsInProse(t, findPersonMentionsInProse(t, a))

describe('people named in prose', () => {
  it('links a full name used as a word', () => {
    expect(link('Reach out to Matthew Jukes to confirm', full)).toBe(
      'Reach out to [Matthew Jukes](cc://person/Matthew%20Jukes) to confirm'
    )
    expect(link('As suggested by Caitlin Baron, run it', full)).toBe(
      'As suggested by [Caitlin Baron](cc://person/Caitlin%20Baron), run it'
    )
  })
  it('links a first name, keeping it as the label', () => {
    expect(link('Weekly meetings with Kathy, at least initially')).toBe(
      'Weekly meetings with [Kathy](cc://person/Kathy%20Rastle), at least initially'
    )
    // A possessive keeps the apostrophe outside the chip.
    expect(link("Review Kathy's paper")).toBe("Review [Kathy](cc://person/Kathy%20Rastle)'s paper")
  })
  it('leaves out a first name two people share, and says who they are', () => {
    expect(firsts.map((a) => a.text).sort()).toEqual(['Kathy', 'Matthew', 'Thomas'])
    expect(ambiguous.get('Caitlin')).toEqual(['Caitlin Baron', 'Caitlin Collis'])
    expect(ambiguous.get('Robert')).toEqual(['Robert Darby', 'Robert De Vries'])
    expect(link('Caitlin is in London')).toBe('Caitlin is in London')
  })
  it('leaves a first name alone where a longer name follows', () => {
    expect(link('Thomas Henry Huxley (1870) said')).toBe('Thomas Henry Huxley (1870) said')
    expect(link('Dr James D Williams, Reader')).toBe('Dr James D Williams, Reader')
    expect(link('**Name**: Kathy Rastleton')).toBe('**Name**: Kathy Rastleton')
    expect(shortFormProblem('Thomas Henry', 6)).toMatch(/longer name/)
  })
  it('leaves a first name alone where it reads as a citation', () => {
    expect(link('Collier and Thomas (2017), Bialystok (2005)')).toBe(
      'Collier and Thomas (2017), Bialystok (2005)'
    )
    expect(shortFormProblem('Thomas (2017)', 6)).toMatch(/citation/)
    expect(shortFormProblem('Thomas (2017a)', 6)).toMatch(/citation/)
  })
  it('still links a first name before an acronym in capitals', () => {
    expect(link('Share with Kathy PGR Student Start of Session Form')).toContain(
      '[Kathy](cc://person/Kathy%20Rastle) PGR'
    )
    expect(shortFormProblem('Kathy PGR Student', 5)).toBe('')
    expect(shortFormProblem('Kathy OOO April 2', 5)).toBe('')
    // A single initial is still part of a longer name, not an acronym.
    expect(shortFormProblem('James D Williams', 5)).toMatch(/longer name/)
  })
  it('still links a first name before a weekday or month', () => {
    expect(link('next meeting with Kathy Tuesday, Oct 14')).toContain(
      '[Kathy](cc://person/Kathy%20Rastle) Tuesday'
    )
    expect(link('Matthew October plans')).toContain('[Matthew](cc://person/Matthew%20Jukes)')
    expect(shortFormProblem('Kathy Tuesday', 5)).toBe('')
  })
  it('reports what it skipped and why', () => {
    const scan = scanPersonMentionsInProse('Thomas Henry Huxley met Kathy', all)
    expect(scan.mentions.map((m) => m.text)).toEqual(['Kathy'])
    expect(scan.skipped).toHaveLength(1)
    expect(scan.skipped[0]).toMatchObject({ text: 'Thomas' })
    expect(scan.skipped[0].reason).toMatch(/longer name/)
  })
  it('matches the longer spelling when one name contains another', () => {
    expect(link('met Robert De Vries today', full)).toBe(
      'met [Robert De Vries](cc://person/Robert%20De%20Vries) today'
    )
    // The full name wins over the first name inside it.
    expect(link('met Kathy Rastle today')).toBe(
      'met [Kathy Rastle](cc://person/Kathy%20Rastle) today'
    )
    const both: PersonAlias[] = [
      { text: 'Robert Darby', name: 'Robert Darby' },
      { text: 'Robert Darby Jones', name: 'Robert Darby Jones' }
    ]
    const t = 'met Robert Darby Jones today'
    expect(applyPersonMentionsInProse(t, findPersonMentionsInProse(t, both))).toBe(
      'met [Robert Darby Jones](cc://person/Robert%20Darby%20Jones) today'
    )
  })
  it('does not match inside a longer word', () => {
    expect(link('Matthew Jukeson said', full)).toBe('Matthew Jukeson said')
    expect(link('xKathy Rastle')).toBe('xKathy Rastle')
    expect(link('Kathyrine went')).toBe('Kathyrine went')
  })
  it('leaves protected text alone', () => {
    expect(link('---\nattendees:\n  - Kathy Rastle\n---\n\nbody')).toBe(
      '---\nattendees:\n  - Kathy Rastle\n---\n\nbody'
    )
    expect(link('### Kathy Rastle')).toBe('### Kathy Rastle')
    expect(link('`Kathy`')).toBe('`Kathy`')
    expect(link('```\nKathy\n```')).toBe('```\nKathy\n```')
    expect(link('[Kathy](cc://person/Kathy%20Rastle) said')).toBe(
      '[Kathy](cc://person/Kathy%20Rastle) said'
    )
    expect(link('[see Kathy](https://example.com/x)')).toBe('[see Kathy](https://example.com/x)')
  })
  it('links every occurrence, in order', () => {
    const t = 'Kathy met Matthew Jukes, and Kathy wrote it up.'
    const found = findPersonMentionsInProse(t, all)
    expect(found.map((m) => m.name)).toEqual(['Kathy Rastle', 'Matthew Jukes', 'Kathy Rastle'])
    expect(link(t).match(/cc:\/\/person\//g)).toHaveLength(3)
  })
  it('undoes its own rewrite exactly', () => {
    const t = "Kathy met Matthew Jukes; Kathy's notes mention Robert De Vries and Thomas."
    const found = findPersonMentionsInProse(t, all)
    expect(undoPersonMentionsInProse(applyPersonMentionsInProse(t, found), found)).toBe(t)
  })
})

const ME = 'Ernesta Orlovaitė'
const cast = [...people, ME, 'Neha Raheel', 'Amrita Gopal']
const every = [...fullNameAliases(cast), ...firstNameAliases(cast).aliases]

describe('the three rules the user set', () => {
  it('reads who was present out of the front matter, in every spelling', () => {
    const head = (body: string): string => `---\n${body}\n---\n\n`
    expect(peoplePresent(head('attendees: [Kathy Rastle, Ernesta Orlovaitė]'))).toEqual([
      'Kathy Rastle',
      'Ernesta Orlovaitė'
    ])
    expect(peoplePresent(head('attendees:\n  - Kathy Rastle\n  - "Ernesta Orlovaitė"'))).toEqual([
      'Kathy Rastle',
      'Ernesta Orlovaitė'
    ])
    expect(peoplePresent(head('attendees: Kathy Rastle'))).toEqual(['Kathy Rastle'])
    expect(peoplePresent(head('leads: [Robert Darby]'))).toEqual(['Robert Darby'])
    expect(peoplePresent(head('lead: Robert Darby'))).toEqual(['Robert Darby'])
    expect(peoplePresent(head('series: Other\ndate: 2026-01-02'))).toEqual([])
    expect(peoplePresent('')).toEqual([])
  })
  it('rule 1: never the user themselves', () => {
    const plan = planPersonChips('Ernesta met Matthew Jukes.', every, { skip: new Set([ME]) })
    expect(plan.next).toBe('Ernesta met [Matthew Jukes](cc://person/Matthew%20Jukes).')
  })
  it('rule 2: never someone who was in the meeting', () => {
    const skip = new Set(['Kathy Rastle', ME])
    const t = 'Kathy is in the office, and Matthew Jukes sent the contract.'
    expect(planPersonChips(t, every, { skip }).next).toBe(
      'Kathy is in the office, and [Matthew Jukes](cc://person/Matthew%20Jukes) sent the contract.'
    )
  })
  it('rule 3: only the first mention of a person per note', () => {
    const t = 'Get Biruke up to speed. Later, Biruke was in charge. Then Biruke left.'
    const plan = planPersonChips(t, [...fullNameAliases(['Biruke Wesenseged'])], {
      firstMentionOnly: true
    })
    expect(plan.next).toBe(t)
    const withFirst = [
      ...fullNameAliases(['Biruke Wesenseged']),
      ...firstNameAliases(['Biruke Wesenseged']).aliases
    ]
    expect(planPersonChips(t, withFirst, { firstMentionOnly: true }).next).toBe(
      'Get [Biruke](cc://person/Biruke%20Wesenseged) up to speed. Later, Biruke was in charge. Then Biruke left.'
    )
  })
  it('rule 3 counts the full name and the first name as the same person', () => {
    const t = 'Weekly check-ins: Amrita Gopal + me. Later Amrita will check with Neha Raheel.'
    const plan = planPersonChips(t, every, { firstMentionOnly: true })
    expect(plan.next).toBe(
      'Weekly check-ins: [Amrita Gopal](cc://person/Amrita%20Gopal) + me. Later Amrita will check with [Neha Raheel](cc://person/Neha%20Raheel).'
    )
  })
  it('takes away chips that break a rule, not just adds the ones it wants', () => {
    const t =
      '[Ernesta](cc://person/Ernesta%20Orlovait%C4%97) met [Kathy](cc://person/Kathy%20Rastle); ' +
      '[Kathy](cc://person/Kathy%20Rastle) agreed. Matthew Jukes will sign.'
    const plan = planPersonChips(t, every, { skip: new Set([ME]), me: ME, firstMentionOnly: true })
    expect(plan.next).toBe(
      'Ernesta met [Kathy](cc://person/Kathy%20Rastle); Kathy agreed. ' +
        '[Matthew Jukes](cc://person/Matthew%20Jukes) will sign.'
    )
    expect(plan.removed.map((r) => r.name)).toEqual([ME, 'Kathy Rastle'])
    // Each removal says which rule it was.
    expect(plan.removed.map((r) => r.reason)).toEqual([
      'is you',
      'not the first mention in this note'
    ])
    expect(plan.added).toBe(1)
    expect(plan.kept).toBe(1)
  })
  it('only ever moves chips, never the prose', () => {
    const t =
      '---\nattendees: [Kathy Rastle]\n---\n\n## Notes\n' +
      '- Ernesta met [Kathy](cc://person/Kathy%20Rastle) and Matthew Jukes on Monday.\n' +
      "- Matthew's view: see [Castles et al., 2018](cc://reading/castles2018).\n"
    const plan = planPersonChips(t, every, {
      skip: new Set([ME, 'Kathy Rastle']),
      me: ME,
      firstMentionOnly: true
    })
    expect(plan.removed.map((r) => r.reason)).toContain('was in the meeting')
    expect(unchipPersonMentions(plan.next)).toBe(unchipPersonMentions(t))
    // The reading chip is untouched, and Kathy's chip is gone because she was there.
    expect(plan.next).toContain('cc://reading/castles2018')
    expect(plan.next).not.toContain('cc://person/Kathy')
    expect(plan.next).toContain('[Matthew Jukes](cc://person/Matthew%20Jukes)')
  })
  it('is idempotent: running it on its own output changes nothing', () => {
    const t =
      '---\nattendees: [Kathy Rastle, Ernesta Orlovaitė]\n---\n\n' +
      'Ernesta met Kathy; Matthew Jukes sent it, and Matthew replied. Neha Raheel is supportive.\n'
    const opts = { skip: new Set([ME, 'Kathy Rastle']), firstMentionOnly: true }
    const once = planPersonChips(t, every, opts).next
    const twice = planPersonChips(once, every, opts).next
    expect(twice).toBe(once)
    expect(once).toContain('[Matthew Jukes](cc://person/Matthew%20Jukes)')
    expect(once).toContain('[Neha Raheel](cc://person/Neha%20Raheel)')
    expect(once).not.toContain('cc://person/Kathy')
    expect(once).not.toContain('cc://person/Ernesta')
  })
})

describe('explicit aliases the user decided', () => {
  const entries = [
    { text: 'Caitlin B.', person: 'Caitlin Baron' },
    { text: 'Chris', person: 'Chris Cummiskey', workspaces: ['work'] },
    {
      text: 'Chris',
      person: 'Chris Cummiskey',
      notes: ['meetings/research/2026-05-21 Luminos.md']
    },
    { text: 'Caitlin', person: 'Caitlin Baron', notes: ['meetings/work/2025-10-20 Impact.md'] }
  ]
  it('reads the workspace out of a note path', () => {
    expect(workspaceOf('meetings/work/2026-07-09 Impact.md')).toBe('work')
    expect(workspaceOf('notes/life/Something.md')).toBe('life')
    expect(workspaceOf('meetings/research/x.md')).toBe('research')
    expect(workspaceOf('readings/kim2020.md')).toBe('')
    expect(workspaceOf('Training plan.md')).toBe('')
  })
  it('an unscoped entry applies everywhere', () => {
    expect(aliasesFor(entries, 'meetings/research/x.md').map((a) => a.text)).toContain('Caitlin B.')
    expect(aliasesFor(entries, 'readings/kim2020.md').map((a) => a.text)).toContain('Caitlin B.')
  })
  it('a workspace-scoped entry applies only there', () => {
    expect(aliasesFor(entries, 'meetings/work/2026-07-09 Impact.md').map((a) => a.name)).toContain(
      'Chris Cummiskey'
    )
    expect(aliasesFor(entries, 'meetings/research/2026-02-11 Supervision.md')).toEqual([
      { text: 'Caitlin B.', name: 'Caitlin Baron', short: true }
    ])
  })
  it('a note-scoped entry applies only to that note', () => {
    const luminos = aliasesFor(entries, 'meetings/research/2026-05-21 Luminos.md')
    expect(luminos.map((a) => a.text)).toEqual(['Caitlin B.', 'Chris'])
    const impact = aliasesFor(entries, 'meetings/work/2025-10-20 Impact.md').map((a) => a.text)
    expect(impact).toEqual(['Caitlin B.', 'Chris', 'Caitlin'])
  })
  it('links the explicit alias, longer spelling first', () => {
    const aliases = [
      ...aliasesFor(entries, 'meetings/work/2026-02-19 Impact.md'),
      ...fullNameAliases(['Caitlin Baron', 'Caitlin Collis'])
    ]
    const t = 'Budget was not approved but Caitlin B. agreed to an extension.'
    expect(planPersonChips(t, aliases, { firstMentionOnly: true }).next).toBe(
      'Budget was not approved but [Caitlin B.](cc://person/Caitlin%20Baron) agreed to an extension.'
    )
  })
})
