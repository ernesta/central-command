// @vitest-environment jsdom
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { getMarkdown } from '@milkdown/kit/utils'
import { describe, expect, it } from 'vitest'
import { pastedLinkTarget } from './notes-links'
import { withNotesPlugins } from './notes-editor-setup'

async function withEditor(
  markdown: string,
  run: (view: EditorView, read: () => string) => void
): Promise<void> {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await withNotesPlugins(
    Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
    })
  ).create()
  run(
    editor.action((ctx) => ctx.get(editorViewCtx)),
    () => editor.action(getMarkdown())
  )
  await editor.destroy()
  root.remove()
}

/** Type text one character at a time through the editor's own text-input handlers (which run input rules). */
function type(view: EditorView, text: string): void {
  for (const char of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, char, () => view.state.tr)
    )
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to))
  }
}

function paste(view: EditorView, text: string | null): boolean {
  const event = {
    isTrusted: true,
    clipboardData: text === null ? null : { getData: () => text }
  }
  return !!view.someProp('handlePaste', (f) =>
    f(view, event as unknown as ClipboardEvent, view.state.doc.slice(0, 0))
  )
}

describe('pastedLinkTarget', () => {
  it.each([
    ['https://example.org/a?b=1', 'https://example.org/a?b=1'],
    ['  http://example.org  ', 'http://example.org'],
    ['www.example.org/x', 'https://www.example.org/x'],
    ['mailto:a@b.org', 'mailto:a@b.org']
  ])('takes %s as an address', (text, expected) => {
    expect(pastedLinkTarget(text)).toBe(expected)
  })

  it.each(['', 'hello', 'see https://example.org', 'https://a.org https://b.org', 'ftp://x.org'])(
    'does not take %j as an address',
    (text) => {
      expect(pastedLinkTarget(text)).toBeNull()
    }
  )
})

describe('typing [text](address)', () => {
  it('becomes a link, written back as the same Markdown', async () => {
    await withEditor('', (view, read) => {
      type(view, 'See [the paper](https://example.org/a) now')
      expect(read()).toBe('See [the paper](https://example.org/a) now\n')
      expect(view.dom.querySelector('a')?.getAttribute('href')).toBe('https://example.org/a')
      expect(view.dom.textContent).toBe('See the paper now')
    })
  })

  it('does not treat an image as a link', async () => {
    await withEditor('', (view) => {
      type(view, '![alt](a.png)')
      expect(view.dom.querySelector('a')).toBeNull()
    })
  })

  it('leaves the text typed after the link outside it', async () => {
    await withEditor('', (view) => {
      type(view, '[a](https://x.org)b')
      expect(view.dom.querySelector('a')?.textContent).toBe('a')
    })
  })
})

describe('pasting an address over selected text', () => {
  const selectWord = (view: EditorView): void => {
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 6, 10)) // "word" in "Some word here"
    )
  }

  it('links the selection', async () => {
    await withEditor('Some word here\n', (view, read) => {
      selectWord(view)
      expect(paste(view, 'https://example.org')).toBe(true)
      expect(read()).toBe('Some [word](https://example.org) here\n')
    })
  })

  it('replaces a link that was already there', async () => {
    await withEditor('Some [word](https://old.org) here\n', (view, read) => {
      selectWord(view)
      paste(view, 'https://new.org')
      expect(read()).toBe('Some [word](https://new.org) here\n')
    })
  })

  it('leaves an ordinary paste, an empty selection and a plain paste alone', async () => {
    await withEditor('Some word here\n', (view, read) => {
      selectWord(view)
      expect(paste(view, 'just words')).toBe(false)
      expect(paste(view, null)).toBe(false)
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)))
      expect(paste(view, 'not an address')).toBe(false)
      expect(read()).toBe('Some word here\n')
    })
  })
})

describe('addresses are always links', () => {
  it('links a pasted address when nothing is selected', async () => {
    await withEditor('Some word here\n', (view, read) => {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 6)))
      expect(paste(view, 'https://example.org/a')).toBe(true)
      expect(read()).toBe('Some <https://example.org/a>word here\n')
    })
  })

  it('links a typed address at the space, keeping trailing punctuation outside', async () => {
    await withEditor('', (view) => {
      type(view, 'See https://example.org/a. Or www.example.org now')
      const links = [...view.dom.querySelectorAll('a')].map((a) => [
        a.textContent,
        a.getAttribute('href')
      ])
      expect(links).toEqual([
        ['https://example.org/a', 'https://example.org/a'],
        ['www.example.org', 'https://www.example.org']
      ])
      expect(view.dom.textContent).toBe('See https://example.org/a. Or www.example.org now')
    })
  })

  it('does not link inside inline code, and leaves typing after the link outside it', async () => {
    await withEditor('`https://example.org` x\n', (view) => {
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)))
      type(view, 'y https://b.org z')
      expect([...view.dom.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
        'https://b.org'
      ])
    })
  })

  it('loads an address already in a file as a link', async () => {
    await withEditor('See https://example.org now\n', (view) => {
      expect(view.dom.querySelector('a')?.getAttribute('href')).toBe('https://example.org')
    })
  })
})
