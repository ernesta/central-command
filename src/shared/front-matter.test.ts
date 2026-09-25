import { describe, expect, it } from 'vitest'
import { joinNote, splitNote, updateHeadKeys } from './front-matter'

const SPEC = { order: ['title', 'tags', 'lead'], keepEmptyList: ['tags'] }

describe('updateHeadKeys (generic)', () => {
  const head = '---\ntitle: One\nfuture: keep me # comment\n---\n\n'

  it('adds keys in the given order and leaves unknown keys alone', () => {
    const next = updateHeadKeys(head, { lead: 'Ada', tags: ['a', 'b'] }, SPEC)
    expect(next).toBe(
      '---\ntitle: One\ntags: [a, b]\nlead: Ada\nfuture: keep me # comment\n---\n\n'
    )
  })

  it('removes a key set to null and an emptied list, but keeps a list marked to keep', () => {
    const start = updateHeadKeys(head, { lead: 'Ada', tags: ['a'] }, SPEC)
    expect(updateHeadKeys(start, { lead: null }, SPEC)).not.toContain('lead')
    expect(updateHeadKeys(start, { tags: [] }, SPEC)).toContain('tags: []')
    expect(updateHeadKeys(start, { tags: [] }, { order: SPEC.order })).not.toContain('tags')
  })

  it('creates a block when there is none, and the body survives a round trip', () => {
    expect(updateHeadKeys('', { title: 'New' }, SPEC)).toBe('---\ntitle: New\n---\n\n')
    const text = '---\ntitle: One\n---\n\nBody\n'
    expect(joinNote(splitNote(text))).toBe(text)
  })
})
