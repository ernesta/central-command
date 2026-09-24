// @vitest-environment jsdom
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { getMarkdown } from '@milkdown/kit/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withNotesPlugins } from '@renderer/notes/notes-editor-setup'
import { parseTodos } from '../shared/todos'
import {
  insertTodo,
  todoHelperPlugin,
  todoMenuCtx,
  type MenuKey,
  type TodoMenuBridge,
  type TodoMenuRequest
} from './todo-helper'

interface Harness {
  editor: Editor
  view: EditorView
  opened: TodoMenuRequest[]
  keys: MenuKey[]
  closed: number
  open: boolean
  markdown: () => string
  /** Put the cursor at the end of the paragraph that ends with `text`. */
  cursorAfter: (text: string) => void
  type: (text: string) => boolean
  press: (
    key: string,
    mods?: Partial<KeyboardEventInit>
  ) => { handled: boolean; prevented: boolean }
}

async function harness(markdown: string): Promise<Harness> {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const h = { opened: [], keys: [], closed: 0, open: false } as unknown as Harness
  const bridge: TodoMenuBridge = {
    open: (request) => {
      h.opened.push(request)
      h.open = true
    },
    close: () => {
      h.closed++
      h.open = false
    },
    isOpen: () => h.open,
    key: (key) => {
      h.keys.push(key)
      return true
    }
  }
  const editor = await withNotesPlugins(
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, markdown)
        ctx.set(todoMenuCtx.key, bridge)
      })
      .use(todoMenuCtx)
      .use(todoHelperPlugin)
  ).create()
  h.editor = editor
  h.view = editor.action((ctx) => ctx.get(editorViewCtx))
  h.markdown = () => editor.action(getMarkdown())
  h.cursorAfter = (text) => {
    let pos = -1
    h.view.state.doc.descendants((node, at) => {
      if (pos === -1 && node.isTextblock && node.textContent.endsWith(text))
        pos = at + 1 + node.content.size
    })
    if (pos === -1) throw new Error(`no paragraph ending with "${text}"`)
    h.view.dispatch(h.view.state.tr.setSelection(TextSelection.create(h.view.state.doc, pos)))
  }
  h.type = (text) => {
    const { from, to } = h.view.state.selection
    const handled =
      h.view.someProp('handleTextInput', (f) =>
        f(h.view, from, to, text, () => h.view.state.tr.insertText(text, from, to))
      ) ?? false
    if (!handled) h.view.dispatch(h.view.state.tr.insertText(text, from, to))
    return handled
  }
  h.press = (key, mods = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods })
    const handled = h.view.someProp('handleKeyDown', (f) => f(h.view, event)) ?? false
    return { handled, prevented: event.defaultPrevented }
  }
  return h
}

let h: Harness
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(async () => {
  vi.useRealTimers()
  await h.editor.destroy()
})

describe('insertTodo', () => {
  it('writes a bold TODO(XX) and a colon, and the text typed next is the TODO text', async () => {
    h = await harness('Discussed weights.\n\nX')
    h.cursorAfter('X')
    h.view.dispatch(
      h.view.state.tr.delete(h.view.state.selection.from - 1, h.view.state.selection.from)
    )
    insertTodo(h.view, h.view.state.selection.from, h.view.state.selection.from, 'EO')
    h.type('Re-run the models')
    expect(h.markdown()).toBe('Discussed weights.\n\n**TODO(EO)**: Re-run the models\n')
    expect(parseTodos(h.markdown()).map((t) => [t.owners, t.text])).toEqual([
      [['EO'], 'Re-run the models']
    ])
  })

  it('writes **TODO**: for no owner', async () => {
    h = await harness('')
    insertTodo(h.view, 1, 1, null)
    h.type('someone should')
    expect(h.markdown()).toBe('**TODO**: someone should\n')
    expect(parseTodos(h.markdown())[0]).toMatchObject({ owners: [], text: 'someone should' })
  })

  it('replaces the range it is given, such as the typed /todo', async () => {
    h = await harness('Point one /todo')
    h.cursorAfter('/todo')
    const end = h.view.state.selection.from
    insertTodo(h.view, end - 5, end, 'KR')
    h.type('check it')
    expect(h.markdown()).toBe('Point one **TODO(KR)**: check it\n')
  })

  it('works inside a bullet', async () => {
    h = await harness('- ')
    h.cursorAfter('')
    const pos = h.view.state.selection.from
    insertTodo(h.view, pos, pos, 'AC')
    h.type('x')
    expect(parseTodos(h.markdown())[0]).toMatchObject({ owners: ['AC'], text: 'x' })
  })
})

describe('typing /todo', () => {
  it('opens the menu over the whole /todo once the last letter is typed, and lets the letter through', async () => {
    h = await harness('Point one /tod')
    h.cursorAfter('/tod')
    expect(h.type('o')).toBe(false)
    await vi.runAllTimersAsync()
    expect(h.opened).toHaveLength(1)
    const { from, to } = h.opened[0]
    expect(h.view.state.doc.textBetween(from, to)).toBe('/todo')
    expect(h.markdown()).toBe('Point one /todo\n')
  })

  it('also works at the very start of a line', async () => {
    h = await harness('/tod')
    h.cursorAfter('/tod')
    h.type('o')
    await vi.runAllTimersAsync()
    expect(h.opened).toHaveLength(1)
  })

  it('does not trigger when the letter replaces a selection', async () => {
    h = await harness('/todX')
    h.cursorAfter('/todX')
    const end = h.view.state.selection.from
    h.view.dispatch(
      h.view.state.tr.setSelection(TextSelection.create(h.view.state.doc, end - 1, end))
    )
    h.type('o')
    await vi.runAllTimersAsync()
    expect(h.opened).toHaveLength(0)
  })

  it('does not trigger inside a word or on other letters', async () => {
    h = await harness('a/tod')
    h.cursorAfter('a/tod')
    h.type('o')
    await vi.runAllTimersAsync()
    expect(h.opened).toHaveLength(0)
    h = await harness('/to')
    h.cursorAfter('/to')
    h.type('d')
    await vi.runAllTimersAsync()
    expect(h.opened).toHaveLength(0)
  })
})

describe('keys', () => {
  it('Cmd/Ctrl+Shift+T opens the menu at the cursor', async () => {
    h = await harness('text')
    h.cursorAfter('text')
    const at = h.view.state.selection.from
    expect(h.press('T', { metaKey: true, shiftKey: true })).toEqual({
      handled: true,
      prevented: true
    })
    expect(h.opened[0]).toMatchObject({ from: at, to: at })
    h.open = false
    h.press('t', { ctrlKey: true, shiftKey: true })
    expect(h.opened).toHaveLength(2)
  })

  it('does nothing for plain T or Cmd+T', async () => {
    h = await harness('text')
    expect(h.press('t').handled).toBe(false)
    expect(h.press('t', { metaKey: true }).handled).toBe(false)
    expect(h.opened).toHaveLength(0)
  })

  it('while open, arrows, Enter, Tab and Escape go to the menu', async () => {
    h = await harness('text')
    h.open = true
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape']) {
      expect(h.press(key)).toEqual({ handled: true, prevented: true })
    }
    expect(h.keys).toEqual(['down', 'up', 'enter', 'enter', 'escape'])
  })

  it('while open, typing a character or Backspace closes the menu and is left to the editor', async () => {
    h = await harness('text')
    h.open = true
    expect(h.press('a').handled).toBe(false)
    expect(h.open).toBe(false)
    h.open = true
    h.press('Backspace')
    expect(h.open).toBe(false)
  })

  it('while closed, Enter and arrows never reach the menu', async () => {
    h = await harness('text')
    h.press('Enter')
    h.press('ArrowDown')
    expect(h.keys).toEqual([])
  })
})
