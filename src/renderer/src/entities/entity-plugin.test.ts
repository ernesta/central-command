// @vitest-environment jsdom
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { getMarkdown } from '@milkdown/kit/utils'
import { describe, expect, it } from 'vitest'
import { withNotesPlugins } from '../notes/notes-editor-setup'
import { entityHostCtx, findSuggestion, type EntityHost } from './entity-plugin'

const host = (over: Partial<EntityHost> = {}): EntityHost => ({
  resolve: () => ({ state: 'pending' }),
  suggest: () => undefined,
  handleKey: () => false,
  detach: () => undefined,
  ...over
})

async function withEditor(
  markdown: string,
  run: (view: EditorView, read: () => string) => void,
  entityHost: EntityHost = host()
): Promise<void> {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await withNotesPlugins(
    Editor.make().config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
      ctx.set(entityHostCtx.key, entityHost)
    })
  ).create()
  run(
    editor.action((ctx) => ctx.get(editorViewCtx)),
    () => editor.action(getMarkdown())
  )
  await editor.destroy()
  root.remove()
}

const TEXT =
  'See [Kathy](cc://person/Kathy%20Rastle) and [a paper](cc://reading/smith2020) and [web](https://x.org).\n'

describe('mentions in the editor', () => {
  it('are drawn as links that keep their own address, and read back as the same Markdown', async () => {
    await withEditor(TEXT, (view, read) => {
      const anchors = [...view.dom.querySelectorAll('a')].map((a) => a.getAttribute('href'))
      expect(anchors).toEqual([
        'cc://person/Kathy%20Rastle',
        'cc://reading/smith2020',
        'https://x.org'
      ])
      expect(read()).toBe(TEXT)
    })
  })

  it('carry their kind and key on the text, and are marked when what they point at is gone', async () => {
    const resolve: EntityHost['resolve'] = (ref) =>
      ref.kind === 'reading' ? { state: 'missing' } : { state: 'pending' }
    await withEditor(
      TEXT,
      (view) => {
        const chips = [...view.dom.querySelectorAll<HTMLElement>('.entity')]
        expect(
          chips.map((c) => [c.dataset.kind, c.dataset.key, c.classList.contains('entity-missing')])
        ).toEqual([
          ['person', 'Kathy Rastle', false],
          ['reading', 'smith2020', true]
        ])
      },
      host({ resolve })
    )
  })

  it('are handed the keys while the picker is open', async () => {
    const keys: string[] = []
    await withEditor(
      'x\n',
      (view) => {
        view.someProp('handleKeyDown', (f) =>
          f(view, new KeyboardEvent('keydown', { key: 'ArrowDown' }))
        )
        expect(keys).toEqual(['ArrowDown'])
      },
      host({ handleKey: (e) => (keys.push(e.key), true) })
    )
  })
})

describe('punctuation after a mention', () => {
  /** Types `text` where the cursor is after the first space that follows `after`. */
  const typeAfter = (view: EditorView, after: string, text: string): boolean => {
    const pos = view.state.doc.textContent.indexOf(after) + after.length + 1 + 1
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
    const { from, to } = view.state.selection
    return !!view.someProp('handleTextInput', (f) => f(view, from, to, text, () => view.state.tr))
  }

  it('takes back the space a mention was followed by', async () => {
    await withEditor('A [Kathy](cc://person/Kathy%20Rastle) and\n', (view, read) => {
      expect(typeAfter(view, 'Kathy', ',')).toBe(true)
      expect(read()).toBe('A [Kathy](cc://person/Kathy%20Rastle),and\n')
    })
  })

  it('leaves a space after ordinary text and after a web link alone, and other characters', async () => {
    await withEditor('A word and\n', (view) => expect(typeAfter(view, 'word', ',')).toBe(false))
    await withEditor('A [web](https://x.org) and\n', (view) =>
      expect(typeAfter(view, 'web', ',')).toBe(false)
    )
    await withEditor('A [Kathy](cc://person/Kathy%20Rastle) and\n', (view) =>
      expect(typeAfter(view, 'Kathy', 'x')).toBe(false)
    )
  })
})

describe('findSuggestion', () => {
  const at = (view: EditorView, text: string): void => {
    view.dispatch(view.state.tr.insertText(text, view.state.doc.content.size - 1))
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)))
  }

  it.each([
    ['Met @', ''],
    ['Met @kat', 'kat'],
    ['@kat', 'kat'],
    ['Met (@kat', 'kat'],
    ['Met @kathy ras', 'kathy ras']
  ])('finds the query in %j', async (text, query) => {
    await withEditor('', (view) => {
      at(view, text)
      const s = findSuggestion(view.state)
      expect(s?.query).toBe(query)
      expect(view.state.doc.textBetween(s!.from, s!.to)).toBe(`@${query}`)
    })
  })

  it.each([
    'mail me a@b.org',
    'meet @ noon',
    'Met @kathy  ras',
    `Met @${'x'.repeat(40)}`,
    'no at sign'
  ])('finds nothing in %j', async (text) => {
    await withEditor('', (view) => {
      at(view, text)
      expect(findSuggestion(view.state)).toBeNull()
    })
  })

  it('finds nothing in code, inside a link, or with text selected', async () => {
    await withEditor('`code @kat`\n\n[a link @kat](https://x.org)\n\nplain @kat\n', (view) => {
      const doc = view.state.doc
      const endOf = (needle: string): number => {
        let found = -1
        doc.descendants((node, pos) => {
          const i = node.isText ? (node.text ?? '').indexOf(needle) : -1
          if (i >= 0) found = pos + i + needle.length
        })
        return found
      }
      for (const [needle, expected] of [
        ['code @kat', false],
        ['a link @kat', false],
        ['plain @kat', true]
      ] as const) {
        view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, endOf(needle))))
        expect(findSuggestion(view.state) !== null).toBe(expected)
      }
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(doc, endOf('plain @kat') - 3, endOf('plain @kat'))
        )
      )
      expect(findSuggestion(view.state)).toBeNull()
    })
  })
})
