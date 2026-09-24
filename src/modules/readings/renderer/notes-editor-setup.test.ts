// @vitest-environment jsdom
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/kit/core'
import { getMarkdown } from '@milkdown/kit/utils'
import { describe, expect, it } from 'vitest'
import { withNotesPlugins } from './notes-editor-setup'

/** Load Markdown into the real editor configuration and read it straight back out. */
async function roundTrip(markdown: string): Promise<string> {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await withNotesPlugins(
    Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
    })
  ).create()
  const out = editor.action(getMarkdown())
  await editor.destroy()
  root.remove()
  return out
}

describe('notes editor Markdown round trip', () => {
  it.each([
    ['headings and paragraphs', '# Title\n\n## Sub\n\nBody text.\n'],
    ['bold, italic and inline code', 'Some **bold**, *italic* and `code`.\n'],
    ['underscore emphasis', 'Some _italic_ and __bold__ text.\n'],
    ['nested and ordered lists', '- one\n- two\n  - nested\n\n1. first\n2. second\n'],
    ['task lists (checkboxes)', '- [ ] todo\n- [x] done\n'],
    ['blockquotes', '> quoted line\n'],
    ['links', 'See [the paper](https://example.org/a) now.\n'],
    ['fenced code blocks', '```r\nlm(y ~ x)\n```\n'],
    ['tables', '| a | b |\n| - | - |\n| 1 | 2 |\n'],
    ['unicode and typographic quotes', 'Über café — “quotes” ł\n'],
    ['horizontal rules', 'One\n\n---\n\nTwo\n'],
    ['strikethrough', 'Some ~~gone~~ text.\n'],
    ['an empty note', '']
  ])('leaves %s exactly as written', async (_name, markdown) => {
    expect(await roundTrip(markdown)).toBe(markdown)
  })

  // Known normalisations: equivalent, valid Markdown that is written back in one canonical
  // form. They only ever apply once the user edits a note; opening a note never rewrites it.
  it('writes star bullets as dash bullets', async () => {
    expect(await roundTrip('* one\n* two\n')).toBe('- one\n- two\n')
  })
  it('writes a two-space hard break as a backslash break', async () => {
    expect(await roundTrip('line one  \nline two\n')).toBe('line one\\\nline two\n')
  })
  it('escapes bare asterisks and underscores', async () => {
    expect(await roundTrip('Price $5 * 2 and a_b\n')).toBe('Price $5 \\* 2 and a\\_b\n')
  })
})
