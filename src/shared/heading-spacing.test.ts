import { describe, expect, it } from 'vitest'
import { tightenHeadings } from './heading-spacing'

describe('tightenHeadings', () => {
  it('removes blank lines before and after headings', () => {
    expect(tightenHeadings('## Summary\n\nText\n\n## Notes\n\n### Topic\n\n- a\n')).toBe(
      '## Summary\nText\n## Notes\n### Topic\n- a\n'
    )
  })

  it('keeps blank lines between paragraphs and other blocks', () => {
    expect(tightenHeadings('## A\none\n\ntwo\n\n- x\n\n| a |\n## B\n')).toBe(
      '## A\none\n\ntwo\n\n- x\n\n| a |\n## B\n'
    )
  })

  it('removes a whole run of blank lines', () => {
    expect(tightenHeadings('text\n\n\n## A\n\n\n\nmore\n')).toBe('text\n## A\nmore\n')
  })

  it('leaves code fences alone, headings and blanks inside them', () => {
    const body = '## A\n\n```\n# not a heading\n\ncode\n\n## nor this\n\n```\n\n## B\n'
    expect(tightenHeadings(body)).toBe(
      '## A\n```\n# not a heading\n\ncode\n\n## nor this\n\n```\n## B\n'
    )
  })

  it('keeps the blank lines at the start and the end of the body', () => {
    expect(tightenHeadings('\n## A\n\ntext\n\n')).toBe('\n## A\ntext\n\n')
  })

  it('keeps CRLF line breaks', () => {
    expect(tightenHeadings('## A\r\n\r\ntext\r\n\r\n## B\r\n')).toBe('## A\r\ntext\r\n## B\r\n')
  })

  it('returns the very same text when no heading has blank lines around it', () => {
    const body = 'text\n\nmore\n## A\nline\n'
    expect(tightenHeadings(body)).toBe(body)
  })

  it('only ever removes blank lines (generated notes)', () => {
    const pieces = [
      '## H',
      '### T',
      '',
      '',
      'text',
      '- [ ] **TODO(EO)**: x',
      '```',
      '> q',
      '| a | b |'
    ]
    let seed = 7
    const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
    for (let n = 0; n < 300; n++) {
      const body = Array.from({ length: 12 }, () => pieces[next() % pieces.length]).join('\n')
      const out = tightenHeadings(body)
      const content = (t: string): string[] => t.split('\n').filter((l) => l.trim() !== '')
      expect(content(out)).toEqual(content(body))
      expect(tightenHeadings(out)).toBe(out)
    }
  })
})
