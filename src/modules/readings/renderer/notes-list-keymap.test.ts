// @vitest-environment jsdom
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { describe, expect, it } from 'vitest'
import { withNotesPlugins } from './notes-editor-setup'
import { liftListItemAtStart } from './notes-list-keymap'

/** Put the cursor `offset` characters into the paragraph containing `text`, press Backspace's command, return the Markdown. */
async function backspaceAt(
  markdown: string,
  text: string,
  offset = 0
): Promise<{ handled: boolean; out: string }> {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await withNotesPlugins(
    Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
    })
  ).create()
  const view = editor.action((ctx) => ctx.get(editorViewCtx))
  let pos = -1
  view.state.doc.descendants((node, at) => {
    if (pos === -1 && node.isTextblock && node.textContent.startsWith(text)) pos = at + 1
  })
  if (pos === -1) throw new Error(`no paragraph starting with "${text}"`)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + offset)))
  const handled = liftListItemAtStart(view.state, view.dispatch)
  const out = editor.action(getMarkdown())
  await editor.destroy()
  root.remove()
  return { handled, out }
}

describe('Backspace at the start of a list item', () => {
  it('turns the first bullet of the note into a paragraph in one press', async () => {
    expect(await backspaceAt('- first\n- second\n\nAfter\n', 'first')).toEqual({
      handled: true,
      out: 'first\n\n- second\n\nAfter\n'
    })
  })

  it('works for a bullet in the middle of a list, splitting the list', async () => {
    expect((await backspaceAt('- a\n- b\n- c\n', 'b')).out).toBe('- a\n\nb\n\n- c\n')
  })

  it('works for the only bullet', async () => {
    expect(await backspaceAt('- only\n', 'only')).toEqual({ handled: true, out: 'only\n' })
  })

  it('works for numbered lists', async () => {
    expect((await backspaceAt('1. one\n2. two\n', 'one')).out).toBe('one\n\n1. two\n')
  })

  it('outdents a nested bullet one level instead of removing it from the list', async () => {
    const { handled, out } = await backspaceAt('- parent\n  - child\n', 'child')
    expect(handled).toBe(true)
    expect(out).toBe('- parent\n- child\n')
  })

  it('takes a task item out of the list', async () => {
    expect((await backspaceAt('- [ ] task\n- [x] done\n', 'task')).out).toBe('task\n\n- [x] done\n')
  })

  it('leaves Backspace alone when the cursor is not at the start of the item', async () => {
    const { handled, out } = await backspaceAt('- first\n- second\n', 'first', 2)
    expect(handled).toBe(false)
    expect(out).toBe('- first\n- second\n')
  })

  it('leaves Backspace alone outside lists', async () => {
    expect(await backspaceAt('# Heading\n\nParagraph\n', 'Paragraph')).toEqual({
      handled: false,
      out: '# Heading\n\nParagraph\n'
    })
  })

  it('leaves Backspace alone at the start of a later paragraph inside an item', async () => {
    const { handled } = await backspaceAt('- first\n\n  second paragraph\n', 'second paragraph')
    expect(handled).toBe(false)
  })
})
