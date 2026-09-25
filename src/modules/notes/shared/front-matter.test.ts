import { describe, expect, it } from 'vitest'
import { applyChanges, joinNote, parseMeta, splitNote, updateHead } from './front-matter'

const FILE = `---
title: Methods: participants
group: Thesis
subgroup: Methods
pinned: true
created: 2026-09-03
imported-from: Thesis/Methods.md
---

Body text
`

describe('parseMeta', () => {
  it('reads every field', () => {
    const { meta, problems } = parseMeta(splitNote(FILE).head)
    expect(meta).toEqual({
      title: 'Methods: participants',
      group: 'Thesis',
      subgroup: 'Methods',
      pinned: true,
      created: '2026-09-03'
    })
    expect(problems).toEqual([])
  })

  it('accepts a note with no front matter', () => {
    const { meta, problems } = parseMeta('')
    expect(meta).toEqual({ title: '', group: '', subgroup: '', pinned: false, created: '' })
    expect(problems).toEqual([])
  })

  it('ignores a subgroup without a group and a bad created date, and says so', () => {
    const { meta, problems } = parseMeta('---\nsubgroup: Methods\ncreated: 3 May\n---\n')
    expect(meta.subgroup).toBe('')
    expect(meta.created).toBe('')
    expect(problems).toEqual(['A subgroup without a group', 'Invalid created date: 3 May'])
  })

  it('reads quoted titles and tidies group spacing', () => {
    const { meta } = parseMeta("---\ntitle: 'It''s: here'\ngroup:   Reading   groups \n---\n")
    expect(meta.title).toBe("It's: here")
    expect(meta.group).toBe('Reading groups')
  })
})

describe('updateHead', () => {
  it('creates a block in the canonical order', () => {
    expect(
      updateHead('', {
        created: '2026-09-25',
        title: 'Methods: participants',
        group: 'Thesis',
        pinned: true
      })
    ).toBe(
      "---\ntitle: 'Methods: participants'\ngroup: Thesis\npinned: true\ncreated: 2026-09-25\n---\n\n"
    )
  })

  it('changes only the keys it is given and keeps unknown keys', () => {
    const head = splitNote(FILE).head
    const next = updateHead(head, { group: 'Analysis', subgroup: '' })
    expect(next).toBe(
      head.replace('group: Thesis', 'group: Analysis').replace('subgroup: Methods\n', '')
    )
    expect(next).toContain('imported-from: Thesis/Methods.md')
  })

  it('removes a group together with its subgroup and never leaves a subgroup alone', () => {
    const head = splitNote(FILE).head
    const next = updateHead(head, { group: '' })
    expect(parseMeta(next).meta).toMatchObject({ group: '', subgroup: '' })
    expect(next).not.toContain('subgroup')
    const ungrouped = updateHead('---\ncreated: 2026-01-01\n---\n', { subgroup: 'Methods' })
    expect(ungrouped).not.toContain('subgroup')
  })

  it('removes an empty title and an unpinned note', () => {
    const next = updateHead(splitNote(FILE).head, { title: '', pinned: false })
    expect(next).not.toContain('title')
    expect(next).not.toContain('pinned')
    expect(next).toContain('group: Thesis')
  })

  it('writes the created date and pinned flag as plain values', () => {
    const next = updateHead('', { created: '2026-09-25', pinned: true })
    expect(parseMeta(next).meta).toMatchObject({ created: '2026-09-25', pinned: true })
    expect(next).toContain('pinned: true\n')
  })
})

describe('applyChanges', () => {
  it('leaves the front matter byte for byte alone in a body change', () => {
    const out = applyChanges(FILE, { body: 'New body\n' })
    expect(out).toBe(splitNote(FILE).head + 'New body\n')
  })

  it('leaves the body byte for byte alone in a metadata change', () => {
    const out = applyChanges(FILE, { meta: { pinned: false } })
    expect(splitNote(out).body).toBe(splitNote(FILE).body)
  })

  it('changes nothing when told nothing', () => {
    expect(applyChanges(FILE, {})).toBe(FILE)
    expect(applyChanges(FILE, { meta: {} })).toBe(FILE)
  })

  it('round trips through split and join', () => {
    expect(joinNote(splitNote(FILE))).toBe(FILE)
  })
})
