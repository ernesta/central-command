import { describe, expect, it } from 'vitest'
import { splitTitleTags } from './title-tags'

describe('splitTitleTags', () => {
  it('takes tags from anywhere in the title', () => {
    expect(splitTitleTags('Write intro #Study #paper')).toEqual({
      title: 'Write intro',
      tags: ['study', 'paper']
    })
    expect(splitTitleTags('#urgent email Kathy')).toEqual({
      title: 'email Kathy',
      tags: ['urgent']
    })
    expect(splitTitleTags('Email #admin Kathy')).toEqual({ title: 'Email Kathy', tags: ['admin'] })
  })
  it('leaves numbers, C# and mid-word hashes alone', () => {
    for (const text of ['Fix issue #12', 'Learn C# basics', 'a#b', 'Just #']) {
      expect(splitTitleTags(text)).toEqual({ title: text, tags: [] })
    }
  })
  it('does not repeat a tag', () => {
    expect(splitTitleTags('x #a #A').tags).toEqual(['a'])
  })
})
