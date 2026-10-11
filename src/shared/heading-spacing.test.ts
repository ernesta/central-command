import { describe, expect, it } from 'vitest'
import { tidyBlankLines, tightenHeadings } from './heading-spacing'

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

describe('tidyBlankLines', () => {
  it('removes blank lines around headings', () => {
    expect(tidyBlankLines('## A\n\ntext\n\n## B\n\n- x\n')).toBe('## A\ntext\n## B\n- x\n')
  })

  it('keeps blank lines between paragraphs, lists and tables', () => {
    const body = 'one\n\ntwo\n\n- x\n\n| a |\n'
    expect(tidyBlankLines(body)).toBe(body)
  })

  it('removes a run of blank lines at the start', () => {
    expect(tidyBlankLines('\n\n  \ntext\n')).toBe('text\n')
  })

  it('ends with exactly one line break after one or several trailing blank lines', () => {
    expect(tidyBlankLines('text\n\n')).toBe('text\n')
    expect(tidyBlankLines('text\n\n\n\n')).toBe('text\n')
    expect(tidyBlankLines('text\n')).toBe('text\n')
  })

  it('counts whitespace-only lines (spaces, tabs, non-breaking spaces) as blank', () => {
    expect(tidyBlankLines(' \t\ntext\n \u00a0\n\t\n')).toBe('text\n')
    expect(tidyBlankLines('text\n   ')).toBe('text\n')
  })

  it('keeps CRLF line breaks', () => {
    expect(tidyBlankLines('\r\n## A\r\n\r\ntext\r\n\r\n\r\n')).toBe('## A\r\ntext\r\n')
  })

  it('keeps blank lines inside a code fence and drops those after the closing fence', () => {
    expect(tidyBlankLines('text\n```\ncode\n\n\n```\n\n\n')).toBe('text\n```\ncode\n\n\n```\n')
  })

  it('keeps the trailing blank lines of a fence that is never closed', () => {
    expect(tidyBlankLines('```\ncode\n\n')).toBe('```\ncode\n\n')
  })

  it('leaves an empty body empty and a blank-only body empty', () => {
    expect(tidyBlankLines('')).toBe('')
    expect(tidyBlankLines('\n \n\n')).toBe('')
  })

  it('adds no line break to a body that has none', () => {
    expect(tidyBlankLines('text')).toBe('text')
    expect(tidyBlankLines('\n\ntext')).toBe('text')
  })

  it('only ever removes blank lines, and a second pass changes nothing (generated notes)', () => {
    const pieces = ['## H', '', '', '  ', 'text', '- a', '```', '> q', '| a | b |']
    let seed = 11
    const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
    const content = (t: string): string[] => t.split('\n').filter((l) => l.trim() !== '')
    for (let n = 0; n < 300; n++) {
      const body =
        Array.from({ length: 12 }, () => pieces[next() % pieces.length]).join('\n') + '\n\n'
      const out = tidyBlankLines(body)
      expect(content(out)).toEqual(content(body))
      expect(tidyBlankLines(out)).toBe(out)
    }
  })
})
