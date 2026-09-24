import { describe, expect, it } from 'vitest'
import { NEW_MEETING_BODY, applyChanges, splitNote } from './front-matter'

const HEAD =
  '---\nseries: Supervision\ncolour: blue # keep me\ndate: 2026-09-24\nattendees: [A B]\n---\n\n'
const BODY = '## Summary\r\n\r\n  odd   spacing\t\r\n\r\n```\n---\n```\n- [ ] **TODO(EO)**: x\n\n\n'

describe('applyChanges', () => {
  it('a body-only change leaves the front matter byte-for-byte alone', () => {
    const out = applyChanges(HEAD + BODY, { body: 'new body\n' })
    expect(out).toBe(HEAD + 'new body\n')
  })

  it('a metadata-only change leaves the body byte-for-byte alone', () => {
    const out = applyChanges(HEAD + BODY, { meta: { start: '10:00', attendees: ['A B', 'C D'] } })
    expect(splitNote(out).body).toBe(BODY)
    expect(out).toContain('colour: blue # keep me')
    expect(out).toContain("start: '10:00'")
  })

  it('no changes gives back the same text', () => {
    expect(applyChanges(HEAD + BODY, {})).toBe(HEAD + BODY)
    expect(applyChanges(HEAD + BODY, { meta: {} })).toBe(HEAD + BODY)
  })

  it('a body written as given replaces the old one entirely', () => {
    expect(applyChanges(HEAD + BODY, { body: '' })).toBe(HEAD)
  })

  it('adds front matter to a file that has none, keeping the body', () => {
    const out = applyChanges('just text\n', { meta: { series: 'Other', date: '2026-01-02' } })
    expect(out).toBe('---\nseries: Other\ndate: 2026-01-02\n---\n\njust text\n')
  })

  it('has a sensible new-meeting body', () => {
    expect(NEW_MEETING_BODY).toBe('## Summary\n\n## Previous TODOs\n\n## Notes\n')
  })
})
