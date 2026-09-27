// @vitest-environment jsdom
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { getMarkdown } from '@milkdown/kit/utils'
import { describe, expect, it } from 'vitest'
import { withNotesPlugins } from './notes-editor-setup'
import { findMatches, replaceAllMatches, replaceMatch } from './notes-find'

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

/** A real editor's view, loaded from Markdown, for tests that dispatch transactions and read the Markdown back. */
async function viewFor(markdown: string): Promise<{
  view: EditorView
  markdown: () => string
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
  return {
    view: editor.ctx.get(editorViewCtx),
    markdown: () => editor.action(getMarkdown()),
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

describe('replaceMatch', () => {
  it('replaces just that match, keeping the rest of the text', async () => {
    const { view, markdown, destroy } = await viewFor('Luminos sent the data. See luminos again.\n')
    const matches = findMatches(view.state.doc, 'luminos')
    replaceMatch(view, matches[1], 'Luminos')
    expect(markdown()).toBe('Luminos sent the data. See Luminos again.\n')
    await destroy()
  })

  it('keeps the match’s own marks (bold stays bold)', async () => {
    const { view, markdown, destroy } = await viewFor('This is **luminos** in bold.\n')
    const matches = findMatches(view.state.doc, 'luminos')
    replaceMatch(view, matches[0], 'Luminos')
    expect(markdown()).toBe('This is **Luminos** in bold.\n')
    await destroy()
  })
})

describe('replaceAllMatches', () => {
  it('replaces every match in one transaction (one undo step)', async () => {
    const { view, markdown, destroy } = await viewFor('Luminos sent the data. See luminos again.\n')
    const matches = findMatches(view.state.doc, 'luminos')
    const before = view.state
    replaceAllMatches(view, matches, 'Fab AI')
    expect(markdown()).toBe('Fab AI sent the data. See Fab AI again.\n')
    // One transaction means one history step: a single undo returns the whole document at once.
    expect(view.state.doc.eq(before.doc)).toBe(false)
    await destroy()
  })

  it('is correct with a replacement of a different length than the query, in either direction', async () => {
    const { view, markdown, destroy } = await viewFor('cat sat on a cat mat with the cat.\n')
    const matches = findMatches(view.state.doc, 'cat')
    replaceAllMatches(view, matches, 'elephant')
    expect(markdown()).toBe('elephant sat on a elephant mat with the elephant.\n')
    await destroy()
  })

  it('does nothing for an empty match list', async () => {
    const { view, markdown, destroy } = await viewFor('Some text.\n')
    replaceAllMatches(view, [], 'x')
    expect(markdown()).toBe('Some text.\n')
    await destroy()
  })

  // A mutation check (CLAUDE.md: safety-critical logic should be deliberately broken to confirm a test
  // catches it): applying matches in document order instead of back-to-front, with each `insertText` using
  // the *original* positions, silently corrupts everything after the first replacement once the replacement
  // text is a different length than the query. This test was confirmed to fail against that broken ordering
  // before `replaceAllMatches` was written to sort descending.
  it('is still correct when a later match would otherwise land on a position the transaction already moved', async () => {
    const { view, markdown, destroy } = await viewFor('aa aa aa\n')
    const matches = findMatches(view.state.doc, 'aa')
    expect(matches).toHaveLength(3)
    replaceAllMatches(view, matches, 'bbbb')
    expect(markdown()).toBe('bbbb bbbb bbbb\n')
    await destroy()
  })
})
