import { describe, expect, it } from 'vitest'
import { markdownOutline } from './markdown-outline'

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
