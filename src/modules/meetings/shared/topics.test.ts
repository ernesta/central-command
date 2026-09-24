import { describe, expect, it } from 'vitest'
import { parseTopics } from './topics'

const NOTE = `## Summary

Text.

## Previous TODOs

- [ ] **TODO(EO)**: x

## Notes

Intro line.

### Study 1 model results

- Weights were applied twice.

### Ethics application timeline

### Study 1 model results
`

describe('parseTopics', () => {
  it('lists the level-3 headings under Notes, in order, with offsets', () => {
    const topics = parseTopics(NOTE)
    expect(topics.map((t) => t.text)).toEqual([
      'Study 1 model results',
      'Ethics application timeline',
      'Study 1 model results'
    ])
    for (const t of topics) expect(NOTE.slice(t.offset, t.offset + 4)).toBe('### ')
  })

  it('marks discussed topics by exact heading text', () => {
    const topics = parseTopics(NOTE, ['Ethics application timeline'])
    expect(topics.map((t) => t.discussed)).toEqual([false, true, false])
    // A renamed heading no longer matches: it counts as not discussed.
    expect(parseTopics(NOTE, ['ethics application timeline']).every((t) => !t.discussed)).toBe(true)
    // Duplicate headings share their state.
    expect(parseTopics(NOTE, ['Study 1 model results']).map((t) => t.discussed)).toEqual([
      true,
      false,
      true
    ])
  })

  it('ignores level-3 headings outside Notes', () => {
    expect(
      parseTopics(
        '## Summary\n### not a topic\n## Notes\n### a topic\n## Other\n### not this\n'
      ).map((t) => t.text)
    ).toEqual(['a topic'])
  })

  it('falls back to level-2 headings other than Summary, Previous TODOs and Notes', () => {
    const luminos =
      '## Summary\n\n## Previous TODOs\n\n## Agenda item\n\ntext\n\n## Second thing\n\n## Notes\n'
    expect(parseTopics(luminos).map((t) => t.text)).toEqual(['Agenda item', 'Second thing'])
  })

  it('prefers level-3 topics when both exist', () => {
    expect(parseTopics('## Other\n## Notes\n### Real\n').map((t) => t.text)).toEqual(['Real'])
  })

  it('has no topics for bold pseudo-headings, an empty note or no headings', () => {
    expect(parseTopics('## Notes\n\n**Study 1**\n\ntext\n')).toEqual([])
    expect(parseTopics('')).toEqual([])
    expect(parseTopics('just text')).toEqual([])
  })

  it('ignores headings in code fences and reads CRLF', () => {
    expect(parseTopics('## Notes\n```\n### fake\n```\n### real\n').map((t) => t.text)).toEqual([
      'real'
    ])
    expect(parseTopics('## Notes\r\n### A\r\n### B\r\n').map((t) => t.text)).toEqual(['A', 'B'])
  })

  it('strips closing hashes and skips empty headings', () => {
    expect(parseTopics('## Notes\n### A ###\n###\n').map((t) => t.text)).toEqual(['A'])
  })
})
