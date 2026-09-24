import { describe, expect, it } from 'vitest'
import { appendTopic, parseTopics } from './topics'

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

describe('appendTopic', () => {
  it('adds the heading at the end of the Notes section, before the next level-2 heading', () => {
    expect(appendTopic('## Notes\n\n### A\n\ntext\n\n## Later\n', 'New one')).toBe(
      '## Notes\n\n### A\n\ntext\n\n### New one\n\n## Later\n'
    )
  })
  it('adds it to an empty Notes section and to a Notes section at the very end', () => {
    expect(appendTopic('## Notes\n', 'A')).toBe('## Notes\n\n### A\n')
    expect(appendTopic('## Summary\n\n## Notes\n\n### A\n\n- x\n', 'B')).toBe(
      '## Summary\n\n## Notes\n\n### A\n\n- x\n\n### B\n'
    )
    expect(appendTopic('## Notes\n- x', 'B')).toBe('## Notes\n- x\n\n### B\n')
  })
  it('creates a Notes section when there is none', () => {
    expect(appendTopic('## Summary\n\nHi\n', 'A')).toBe('## Summary\n\nHi\n\n## Notes\n\n### A\n')
    expect(appendTopic('', 'A')).toBe('## Notes\n\n### A\n')
  })
  it('the new topic then shows up in the topic list, last', () => {
    const body = appendTopic('## Notes\n\n### A\n', 'B ')
    expect(parseTopics(body).map((t) => t.text)).toEqual(['A', 'B'])
  })
  it('cleans the title and ignores an empty one', () => {
    expect(appendTopic('## Notes\n', '  ## Two\nlines  ')).toBe('## Notes\n\n### Two lines\n')
    expect(appendTopic('## Notes\n', '   ')).toBe('## Notes\n')
  })
  it('follows CRLF and never writes inside an unclosed fence', () => {
    expect(appendTopic('## Notes\r\n### A\r\n', 'B')).toBe('## Notes\r\n### A\r\n\r\n### B\r\n')
    expect(appendTopic('## Notes\n```\ncode', 'B')).toBe('## Notes\n\n### B\n```\ncode')
    expect(appendTopic('text\n```\ncode', 'B')).toBe('text\n\n## Notes\n\n### B\n\n```\ncode')
  })
  it('ignores a Notes heading inside a code fence', () => {
    expect(appendTopic('```\n## Notes\n```\n', 'B')).toBe(
      '```\n## Notes\n```\n\n## Notes\n\n### B\n'
    )
  })
  it('only ever inserts: every original character stays in order (generated notes)', () => {
    const pieces = [
      '## Summary',
      '## Notes',
      '### Topic',
      '',
      'text  ',
      '```',
      '- x',
      '---',
      '# Top'
    ]
    let seed = 99
    const rnd = (n: number): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n)
    for (let n = 0; n < 2000; n++) {
      const eol = rnd(4) === 0 ? '\r\n' : '\n'
      const body =
        Array.from({ length: rnd(12) }, () => pieces[rnd(pieces.length)]).join(eol) +
        (rnd(2) ? eol : '')
      const out = appendTopic(body, 'ZZ new')
      let i = 0
      for (const c of out) if (i < body.length && c === body[i]) i++
      expect(i).toBe(body.length)
      expect(out).toContain('### ZZ new')
      expect(appendTopic(out, '')).toBe(out)
    }
  })
})
