// @vitest-environment jsdom
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import { describe, expect, it } from 'vitest'
import { withNotesPlugins } from './notes-editor-setup'
import { findMatches } from './notes-find'

/** A real editor's document, loaded from Markdown, for tests that need genuine ProseMirror positions. */
async function docFor(markdown: string): Promise<{
  doc: Node
  destroy: () => Promise<void>
}> {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await withNotesPlugins(
    Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
    })
  ).create()
  const doc = editor.ctx.get(editorViewCtx).state.doc
  return {
    doc,
    destroy: async () => {
      await editor.destroy()
      root.remove()
    }
  }
}

describe('findMatches', () => {
  it('finds every case-insensitive match, in order, at the right positions', async () => {
    const { doc, destroy } = await docFor('Luminos sent the data. See luminos again.\n')
    const matches = findMatches(doc, 'luminos')
    expect(matches).toHaveLength(2)
    for (const m of matches) {
      expect(doc.textBetween(m.from, m.to).toLowerCase()).toBe('luminos')
    }
    expect(matches[0].from).toBeLessThan(matches[1].from)
    await destroy()
  })

  it('is empty for an empty or blank query, and for a query with no match', async () => {
    const { doc, destroy } = await docFor('Some text.\n')
    expect(findMatches(doc, '')).toEqual([])
    expect(findMatches(doc, '   ')).toEqual([])
    expect(findMatches(doc, 'zzzzqq')).toEqual([])
    await destroy()
  })

  it('finds a match inside a heading and inside a list item', async () => {
    const { doc, destroy } = await docFor('## Luminos plan\n\n- ask luminos for the data\n')
    expect(findMatches(doc, 'luminos')).toHaveLength(2)
    await destroy()
  })

  it('does not match across a mark boundary (a word split between bold and plain text)', async () => {
    const { doc, destroy } = await docFor('**Lumi**nos was not found whole.\n')
    expect(findMatches(doc, 'luminos')).toEqual([])
    await destroy()
  })
})
