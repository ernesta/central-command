import { describe, expect, it } from 'vitest'
import { locatedOutline, markdownOutline, visibleOutline } from './markdown-outline'

describe('markdownOutline', () => {
  it('keeps only the given levels, in order', () => {
    const md = '# Title\n\n## Priority 1\n\n### Reading\n\nSome text.\n\n## Priority 2\n'
    expect(markdownOutline(md, [2, 3])).toEqual([
      { level: 2, text: 'Priority 1' },
      { level: 3, text: 'Reading' },
      { level: 2, text: 'Priority 2' }
    ])
    expect(markdownOutline(md, [1])).toEqual([{ level: 1, text: 'Title' }])
  })

  it('strips emphasis, code ticks, link syntax and a trailing #', () => {
    expect(markdownOutline('## **Bold** and `code` and [a link](https://x.y) ##', [2])).toEqual([
      { level: 2, text: 'Bold and code and a link' }
    ])
  })

  it('skips a heading-looking line inside a fenced code block', () => {
    expect(markdownOutline('```\n## not a heading\n```\n## Real', [2])).toEqual([
      { level: 2, text: 'Real' }
    ])
  })

  it('drops an empty heading and is empty for text with no headings', () => {
    expect(markdownOutline('## \n', [2])).toEqual([])
    expect(markdownOutline('Just a paragraph.', [1, 2, 3])).toEqual([])
  })
})

describe('locatedOutline', () => {
  it('gives the line of each heading, counting from 0, over fences, blank lines and both kinds of line break', () => {
    const md = '# One\n\n```\n## no\n```\r\n## Two\n\n### Three'
    expect(locatedOutline(md, [1, 2, 3])).toEqual([
      { level: 1, text: 'One', line: 0 },
      { level: 2, text: 'Two', line: 5 },
      { level: 3, text: 'Three', line: 7 }
    ])
  })
  it('agrees with markdownOutline apart from the line', () => {
    const md = '## A\n\n### B\n\n## \n## C'
    expect(locatedOutline(md, [2, 3]).map(({ level, text }) => ({ level, text }))).toEqual(
      markdownOutline(md, [2, 3])
    )
  })
})

describe('visibleOutline', () => {
  const o = (...levels: number[]): { level: number; text: string }[] =>
    levels.map((level, i) => ({ level, text: `h${i}` }))
  const indexes = (outline: { level: number; text: string }[], current: number | null): number[] =>
    visibleOutline(outline, current).map((e) => e.index)

  it('folds every ### while nothing is being read', () => {
    expect(indexes(o(2, 3, 3, 2, 3), null)).toEqual([0, 3])
  })

  it('unfolds the ###s of the top heading being read', () => {
    expect(indexes(o(2, 3, 3, 2, 3), 0)).toEqual([0, 1, 2, 3])
    expect(indexes(o(2, 3, 3, 2, 3), 3)).toEqual([0, 3, 4])
  })

  it('unfolds the section of a ### being read, and marks its top heading as holding it', () => {
    const outline = o(2, 3, 3, 2, 3)
    expect(indexes(outline, 2)).toEqual([0, 1, 2, 3])
    expect(
      visibleOutline(outline, 2)
        .filter((e) => e.holdsCurrent)
        .map((e) => e.index)
    ).toEqual([0])
  })

  it('treats a ### with no heading above it as a top heading', () => {
    expect(indexes(o(3, 3, 2, 3), null)).toEqual([0, 1, 2])
    expect(indexes(o(3, 3, 2, 3), 2)).toEqual([0, 1, 2, 3])
  })

  it('shows a single heading', () => {
    expect(indexes(o(2), 0)).toEqual([0])
    expect(indexes(o(3), null)).toEqual([0])
  })

  it('keeps a level 1 heading with the level 2s as a top heading', () => {
    expect(indexes(o(1, 2, 3, 2), 2)).toEqual([0, 1, 2, 3])
    expect(indexes(o(1, 2, 3, 2), 0)).toEqual([0, 1, 3])
  })

  it('is empty for an empty outline', () => {
    expect(visibleOutline([], null)).toEqual([])
  })
})
