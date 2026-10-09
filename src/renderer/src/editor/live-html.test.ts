import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './live-html'

describe('markdownToHtml', () => {
  it('draws headings, bold, italics, strikethrough, code and links', () => {
    expect(markdownToHtml('## Notes\n\nA **b** *c* ~~d~~ `e` [f](https://x.y/z?a=1&b=2)')).toBe(
      '<h2>Notes</h2><p>A <strong>b</strong> <em>c</em> <s>d</s> <code>e</code> <a href="https://x.y/z?a=1&amp;b=2">f</a></p>'
    )
  })

  it('draws nested bullets and numbers, and leaves checkboxes out', () => {
    expect(markdownToHtml('* **TODO(EO)**: a\n  * deeper\n* [x] done\n* [ ] open')).toBe(
      '<ul><li><strong>TODO(EO)</strong>: a<ul><li>deeper</li></ul></li><li>done</li><li>open</li></ul>'
    )
    expect(markdownToHtml('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
  })

  it('draws quotes, code fences, rules and tables', () => {
    expect(markdownToHtml('> q\n> r')).toBe('<blockquote><p>q<br>r</p></blockquote>')
    expect(markdownToHtml('```js\na < b\n```')).toBe('<pre><code>a &lt; b</code></pre>')
    expect(markdownToHtml('---')).toBe('<hr>')
    expect(markdownToHtml('| a | b |\n|---|---|\n| 1 | **2** |')).toBe(
      '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table>'
    )
  })

  it('keeps each line of a paragraph a line, and links bare addresses', () => {
    expect(markdownToHtml('one\ntwo http://a.b')).toBe(
      'one<br>two <a href="http://a.b">http://a.b</a>'
    )
  })

  it('returns a single paragraph as bare inline HTML so a paste mid-sentence stays inline', () => {
    expect(markdownToHtml('some **bold** words')).toBe('some <strong>bold</strong> words')
    expect(markdownToHtml('one\n\ntwo')).toBe('<p>one</p><p>two</p>')
  })

  it('escapes what is not Markdown, and shows an escaped mark as itself', () => {
    expect(markdownToHtml('a < b & \\*c\\*')).toBe('a &lt; b &amp; *c*')
  })

  it('leaves a link with no address as its label', () => {
    expect(markdownToHtml('[just text]')).toBe('[just text]')
  })
})
