import { describe, expect, it } from 'vitest'
import { extractSection, parseHeading, scanLines } from './sections'

describe('scanLines', () => {
  it('marks fenced code, including the fences', () => {
    const lines = scanLines('a\n```\nb\n```\nc')
    expect(lines.map((l) => l.inFence)).toEqual([false, true, true, true, false])
    expect(lines.map((l) => l.start)).toEqual([0, 2, 6, 8, 12])
  })
  it('needs a matching fence to close, and tildes are fences too', () => {
    const lines = scanLines('~~~\n```\nx\n~~~\ny')
    expect(lines.map((l) => l.inFence)).toEqual([true, true, true, true, false])
  })
  it('an unclosed fence runs to the end', () => {
    expect(scanLines('```\na\nb').every((l) => l.inFence)).toBe(true)
  })
  it('strips CRLF from line text but keeps offsets exact', () => {
    const lines = scanLines('a\r\nb')
    expect(lines.map((l) => l.text)).toEqual(['a', 'b'])
    expect(lines[1].start).toBe(3)
  })
})

describe('parseHeading', () => {
  it('reads levels and strips closing hashes', () => {
    expect(parseHeading('## Summary')).toEqual({ level: 2, text: 'Summary' })
    expect(parseHeading('### Topic ###')).toEqual({ level: 3, text: 'Topic' })
    expect(parseHeading('   # Indented')).toEqual({ level: 1, text: 'Indented' })
  })
  it('rejects non-headings', () => {
    expect(parseHeading('#nospace')).toBeNull()
    expect(parseHeading('####### seven')).toBeNull()
    expect(parseHeading('    ## code block')).toBeNull()
    expect(parseHeading('text ## not')).toBeNull()
  })
})

describe('extractSection', () => {
  const body =
    '## Summary\n\nOne line.\nTwo lines.\n\n## Previous TODOs\n\n- [ ] x\n\n## Notes\n\n### Topic\n'
  it('returns the trimmed text under the heading', () => {
    expect(extractSection(body, 'Summary')).toBe('One line.\nTwo lines.')
    expect(extractSection(body, 'notes')).toBe('### Topic')
  })
  it('is null when the heading is missing, and empty when the section is', () => {
    expect(extractSection('## Notes\n', 'Summary')).toBeNull()
    expect(extractSection('## Summary\n\n## Notes\n', 'Summary')).toBe('')
  })
  it('stops at a level-1 heading but not at a level-3 one', () => {
    expect(extractSection('## Summary\ntext\n### Sub\nmore\n# Top\nx', 'Summary')).toBe(
      'text\n### Sub\nmore'
    )
  })
  it('ignores headings inside code fences', () => {
    expect(extractSection('```\n## Summary\n```\n## Summary\nreal\n', 'Summary')).toBe('real')
    expect(
      extractSection('## Summary\n```\n## Notes\n```\nstill summary\n## Notes', 'Summary')
    ).toBe('```\n## Notes\n```\nstill summary')
  })
  it('works with CRLF', () => {
    expect(extractSection('## Summary\r\nHello\r\n\r\n## Notes\r\n', 'Summary')).toBe('Hello')
  })
})
