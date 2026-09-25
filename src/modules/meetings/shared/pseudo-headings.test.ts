import { describe, expect, it } from 'vitest'
import { checkConversion, convertPseudoHeadings } from './pseudo-headings'
import { parseTodos } from './todos'
import { parseTopics } from './topics'

const NOTE = `## Summary

Key topics.

## Previous TODOs

- [x] **TODO(EO)**: Add language match data.
- [ ] (Cancelled) **TODO(EO)**: Investigate diglossia.

## Notes

**Luminos Studentship Agreement**
- No response yet.

**Updates on Data**
- Ghana MICS
  - **Decision**: Can look into further.

**Current Theory:**
- Instructional quality barrier
`

describe('convertPseudoHeadings', () => {
  it('turns bold-only lines under Notes into ### headings and changes nothing else', () => {
    const r = convertPseudoHeadings(NOTE)
    expect(r.problems).toEqual([])
    expect(r.converted.map((c) => c.to)).toEqual([
      '### Luminos Studentship Agreement',
      '### Updates on Data',
      '### Current Theory'
    ])
    expect(r.body).toBe(
      NOTE.replace('**Luminos Studentship Agreement**', '### Luminos Studentship Agreement')
        .replace('**Updates on Data**', '### Updates on Data')
        .replace('**Current Theory:**', '### Current Theory')
    )
    expect(parseTopics(r.body).map((t) => t.text)).toEqual([
      'Luminos Studentship Agreement',
      'Updates on Data',
      'Current Theory'
    ])
  })

  it('leaves TODOs, and their ticked state, exactly as they were', () => {
    const r = convertPseudoHeadings(NOTE)
    expect(parseTodos(r.body)).toEqual(parseTodos(NOTE))
  })

  it('accepts a colon after the closing marks', () => {
    expect(convertPseudoHeadings('## Notes\n\n**Topic**:\n- a\n').body).toBe(
      '## Notes\n\n### Topic\n- a\n'
    )
  })

  it('keeps CRLF line endings and a missing final newline', () => {
    const text = '## Notes\r\n\r\n**A**\r\n- x\r\n\r\n**B**'
    expect(convertPseudoHeadings(text).body).toBe('## Notes\r\n\r\n### A\r\n- x\r\n\r\n### B')
  })

  it('does not touch bold lines outside the Notes section, but reports them', () => {
    const text = '## Summary\n\n**Not a topic**\n\n## Notes\n\nplain\n'
    const r = convertPseudoHeadings(text)
    expect(r.body).toBe(text)
    expect(r.leftAlone).toEqual([
      { line: 2, text: '**Not a topic**', reason: 'not in the Notes section' }
    ])
  })

  it('ignores code fences', () => {
    const text = '## Notes\n\n```\n\n**Inside**\n```\n'
    const r = convertPseudoHeadings(text)
    expect(r.body).toBe(text)
    expect(r.leftAlone).toEqual([])
  })

  it('does not convert a bold line that continues a paragraph, or one with more text', () => {
    const text = '## Notes\n\nSome words\n**Emphasis**\n\n**Decision**: yes\n\n**Bold** and more\n'
    const r = convertPseudoHeadings(text)
    expect(r.body).toBe(text)
    expect(r.leftAlone.map((l) => l.reason)).toEqual(['not on a line of its own'])
  })

  it('does not convert a bold TODO line or an over-long sentence', () => {
    const long = `**${'word '.repeat(30).trim()}**`
    const text = `## Notes\n\n**TODO(EO)**\n\n${long}\n`
    const r = convertPseudoHeadings(text)
    expect(r.body).toBe(text)
    expect(r.leftAlone.map((l) => l.reason)).toEqual(['too long to be a title'])
  })

  it('leaves a note that already has ### topics alone', () => {
    const text = '## Notes\n\n### Real topic\n\n**Emphasised line**\n'
    const r = convertPseudoHeadings(text)
    expect(r.body).toBe(text)
    expect(r.converted).toEqual([])
    expect(r.problems).toEqual(['the note already has ### topics'])
  })

  it('is idempotent: a converted note has nothing left to convert', () => {
    const once = convertPseudoHeadings(NOTE)
    const twice = convertPseudoHeadings(once.body)
    expect(twice.body).toBe(once.body)
    expect(twice.converted).toEqual([])
  })

  it('reports nothing for a note with no bold titles', () => {
    const text = '## Notes\n\n- a\n- b\n'
    expect(convertPseudoHeadings(text)).toMatchObject({ body: text, converted: [], problems: [] })
  })
})

describe('checkConversion', () => {
  const before = '## Notes\n\n**A**\n- [ ] **TODO(EO)**: x\n'
  const converted = [{ line: 2, from: '**A**', to: '### A' }]

  it('passes the real conversion', () => {
    expect(
      checkConversion(before, '## Notes\n\n### A\n- [ ] **TODO(EO)**: x\n', converted)
    ).toEqual([])
  })

  it('fails when another line changed', () => {
    const after = '## Notes\n\n### A\n- [ ] **TODO(EO)**: y\n'
    expect(checkConversion(before, after, converted)).toContain('line 4 changed')
  })

  it('fails when a line was added or removed', () => {
    expect(checkConversion(before, '## Notes\n\n### A\n', converted)).toContain(
      'the number of lines changed'
    )
  })

  it('fails when a TODO is ticked or altered', () => {
    const after = '## Notes\n\n### A\n- [x] **TODO(EO)**: x\n'
    expect(checkConversion(before, after, converted)).toContain('the TODOs changed')
  })

  it('fails when the converted line does not read back as a topic', () => {
    const after = '## Notes\n\n#### A\n- [ ] **TODO(EO)**: x\n'
    expect(checkConversion(before, after, converted)).toContain(
      'the converted lines do not read back as the topics'
    )
  })
})
