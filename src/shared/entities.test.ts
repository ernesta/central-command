import { describe, expect, it } from 'vitest'
import {
  addUid,
  readUid,
  entityHref,
  escapeLabel,
  findMentions,
  newUid,
  parseEntityHref,
  renamePersonMentions
} from './entities'

describe('entity addresses', () => {
  it('round trip, whatever the key holds', () => {
    for (const key of [
      'smith2020',
      'Kathy Rastle',
      "O'Brien (Jr.) & co",
      'Ünïcode/slash',
      'a*b~c!'
    ]) {
      const href = entityHref({ kind: 'person', key })
      expect(href).not.toMatch(/[\s()]/)
      expect(parseEntityHref(href)).toEqual({ kind: 'person', key })
    }
  })

  it('rejects addresses that are not ours or are malformed', () => {
    for (const href of [
      'https://x.org',
      'cc://',
      'cc://person',
      'cc://person/',
      'cc://mystery/x',
      'cc://note/%E0%A4%A'
    ]) {
      expect(parseEntityHref(href)).toBeNull()
    }
  })
})

describe('findMentions', () => {
  it('finds mentions with their labels and positions, and ignores web links and fenced code', () => {
    const text =
      'See [Kathy](cc://person/Kathy%20Rastle) and [a paper](cc://reading/smith2020), not [web](https://x.org).\n' +
      '```\n[code](cc://note/abc12345)\n```\n[Plan \\[v2\\]](cc://note/k3f9a2x1)\n'
    const found = findMentions(text)
    expect(found.map((m) => [m.ref.kind, m.ref.key, m.label])).toEqual([
      ['person', 'Kathy Rastle', 'Kathy'],
      ['reading', 'smith2020', 'a paper'],
      ['note', 'k3f9a2x1', 'Plan \\[v2\\]']
    ])
    for (const m of found) expect(text.slice(m.start, m.end)).toMatch(/^\[.*\]\(cc:\/\//)
  })
})

describe('renamePersonMentions', () => {
  const names = new Map([['Kathy Rastle', 'Kathy Smith']])
  it('renames the address and a label that was the name, but not a label the writer chose', () => {
    const text =
      'A [Kathy Rastle](cc://person/Kathy%20Rastle) and [Kath](cc://person/Kathy%20Rastle).\n'
    expect(renamePersonMentions(text, names)).toBe(
      'A [Kathy Smith](cc://person/Kathy%20Smith) and [Kath](cc://person/Kathy%20Smith).\n'
    )
  })

  it('leaves other people, other kinds and text without mentions exactly as they were', () => {
    const text =
      '[Other](cc://person/Other) [Kathy Rastle](cc://reading/Kathy%20Rastle) plain Kathy Rastle\n'
    expect(renamePersonMentions(text, names)).toBe(text)
    expect(renamePersonMentions('x', new Map())).toBe('x')
  })
})

describe('labels and uids', () => {
  it('escapes what would break a link label', () => {
    expect(escapeLabel('a [b] \\ c')).toBe('a \\[b\\] \\\\ c')
  })

  it('makes eight-character uids without look-alikes', () => {
    const seen = new Set(Array.from({ length: 200 }, () => newUid()))
    expect(seen.size).toBeGreaterThan(190)
    for (const uid of seen) expect(uid).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/)
  })
})

describe('uid in a head', () => {
  it('is added at the end of the block, everything else untouched, and read back', () => {
    const head = '---\ntitle: A\n# a comment\ngroup: G\n---\n\n'
    const next = addUid(head, 'k3f9a2x1')
    expect(next).toBe('---\ntitle: A\n# a comment\ngroup: G\nuid: k3f9a2x1\n---\n\n')
    expect(readUid(next)).toBe('k3f9a2x1')
  })

  it('makes a block when there is none, and reads nothing from a head without one', () => {
    expect(addUid('', 'k3f9a2x1')).toBe('---\nuid: k3f9a2x1\n---\n\n')
    expect(readUid('')).toBe('')
    expect(readUid("---\nuid: 'a b'\n---\n")).toBe('')
    expect(readUid('---\nuid: "abcd1234"\n---\n')).toBe('abcd1234')
  })
})
