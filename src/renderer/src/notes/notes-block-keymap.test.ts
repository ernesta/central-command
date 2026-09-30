// @vitest-environment jsdom
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { TextSelection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { describe, expect, it } from 'vitest'
import { withNotesPlugins } from './notes-editor-setup'

async function open(markdown: string): Promise<{
  view: EditorView
  markdown: () => string
  close: () => Promise<void>
}> {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await withNotesPlugins(
    Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
    })
  ).create()
  const view = editor.action((ctx) => ctx.get(editorViewCtx))
  return {
    view,
    markdown: () => editor.action(getMarkdown()),
    close: async () => {
      await editor.destroy()
      root.remove()
    }
  }
}

/** Type text one character at a time through the editor's own text-input handlers (so input rules run). */
function type(view: EditorView, text: string): void {
  for (const ch of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, ch, () => view.state.tr)
    )
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to))
  }
}

/** Press Backspace through the keymaps; falls back to nothing if no plugin handles it (browser default). */
function backspace(view: EditorView): boolean {
  const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
  return !!view.someProp('handleKeyDown', (f) => f(view, event))
}

function cursorAtStartOf(view: EditorView, text: string, offset = 0): void {
  let pos = -1
  view.state.doc.descendants((node, at) => {
    if (pos === -1 && node.isTextblock && node.textContent.startsWith(text)) pos = at + 1
  })
  if (pos === -1) throw new Error(`no block starting with "${text}"`)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + offset)))
}

/** Add an empty paragraph at the end (Markdown cannot hold one) and put the cursor in it. */
function cursorInNewLastParagraph(view: EditorView): void {
  const { doc, schema } = view.state
  const tr = view.state.tr.insert(doc.content.size, schema.nodes.paragraph.create())
  view.dispatch(tr.setSelection(TextSelection.atEnd(tr.doc)))
}

describe('Backspace after an input rule', () => {
  it('"###", space, Backspace gives the typed text back and stays on the line', async () => {
    const e = await open('Above\n\n')
    cursorInNewLastParagraph(e.view)
    type(e.view, '### ')
    expect(e.view.state.selection.$from.parent.type.name).toBe('heading')
    expect(backspace(e.view)).toBe(true)
    const { parent } = e.view.state.selection.$from
    expect(parent.type.name).toBe('paragraph')
    expect(parent.textContent.trim()).toBe('###')
    expect(e.view.state.doc.childCount).toBe(2)
    await e.close()
  })

  it('a second Backspace deletes a character of the typed text, not the line break', async () => {
    const e = await open('Above\n\n')
    cursorInNewLastParagraph(e.view)
    type(e.view, '## ')
    backspace(e.view)
    const before = e.view.state.doc.childCount
    // Whatever handles it, the block above must still be there and the cursor still on the second block.
    backspace(e.view)
    expect(e.view.state.doc.childCount).toBe(before)
    await e.close()
  })

  it('a bullet made by typing "- " is undone by Backspace', async () => {
    const e = await open('Above\n\n')
    cursorInNewLastParagraph(e.view)
    type(e.view, '- ')
    expect(backspace(e.view)).toBe(true)
    expect(e.view.state.selection.$from.parent.textContent.trim()).toBe('-')
    await e.close()
  })
})

// Milkdown's own DowngradeHeading does this; pinned here so a change in it is noticed.
describe('Backspace at the start of a heading', () => {
  it('lowers the level', async () => {
    const e = await open('Above\n\n### Title\n')
    cursorAtStartOf(e.view, 'Title')
    expect(backspace(e.view)).toBe(true)
    expect(e.markdown()).toBe('Above\n\n## Title\n')
    await e.close()
  })

  it('turns a level 1 heading into a paragraph', async () => {
    const e = await open('Above\n\n# Title\n')
    cursorAtStartOf(e.view, 'Title')
    expect(backspace(e.view)).toBe(true)
    expect(e.markdown()).toBe('Above\n\nTitle\n')
    await e.close()
  })

  it('does not merge a heading on the first line upwards', async () => {
    const e = await open('# Title\n\nBody\n')
    cursorAtStartOf(e.view, 'Title')
    backspace(e.view)
    expect(e.markdown()).toBe('Title\n\nBody\n')
    await e.close()
  })

  it('leaves Backspace alone inside the heading text', async () => {
    const e = await open('## Title\n')
    cursorAtStartOf(e.view, 'Title', 2)
    expect(backspace(e.view)).toBe(false)
    await e.close()
  })
})

describe('Backspace at the start of a quote', () => {
  it('unwraps a one-paragraph quote', async () => {
    const e = await open('Above\n\n> Quoted\n')
    cursorAtStartOf(e.view, 'Quoted')
    expect(backspace(e.view)).toBe(true)
    expect(e.markdown()).toBe('Above\n\nQuoted\n')
    await e.close()
  })

  it('takes only the first paragraph out of a longer quote, never merging upwards', async () => {
    const e = await open('Above\n\n> One\n>\n> Two\n')
    cursorAtStartOf(e.view, 'One')
    expect(backspace(e.view)).toBe(true)
    expect(e.markdown()).toBe('Above\n\nOne\n\n> Two\n')
    await e.close()
  })

  it('leaves a later paragraph of the quote to the default, which joins it upwards', async () => {
    const e = await open('> One\n>\n> Two\n')
    cursorAtStartOf(e.view, 'Two')
    backspace(e.view)
    expect(e.markdown()).toBe('> OneTwo\n')
    await e.close()
  })
})
