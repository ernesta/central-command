// @vitest-environment jsdom
import { undo } from '@codemirror/commands'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { openView, show } from '@renderer/editor/live-key-utils'
import { parseTodos } from '../shared/todos'
import type { MenuKey, TodoMenuBridge, TodoMenuRequest } from './todo-live'
import { insertTodoText, liveTodoHelper } from './todo-live'

/** The editor measures on the next frame; that is when the menu is told where to open. */
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

interface Harness {
  view: EditorView
  /** Every text the editor reported as changed, in order. */
  reports: string[]
  opened: TodoMenuRequest[]
  keys: MenuKey[]
  /** Text the menu was sent while open, and the search it holds. */
  searched: () => string
  closed: () => number
  isOpen: () => boolean
  setOpen: (open: boolean) => void
  /** Type one letter at the cursor the way the browser does (an `input.type` change). */
  type: (letter: string) => void
  /** A keydown that reached the editor; whether the editor asked for the browser's default to be stopped. */
  press: (key: string, mods?: Partial<KeyboardEventInit>) => { prevented: boolean }
}

function harness(marked: string): Harness {
  const opened: TodoMenuRequest[] = []
  const keys: MenuKey[] = []
  let closed = 0
  let open = false
  let search = ''
  const bridge: TodoMenuBridge = {
    open: (request) => {
      opened.push(request)
      open = true
    },
    close: () => {
      closed += 1
      open = false
    },
    isOpen: () => open,
    key: (key) => {
      keys.push(key)
      return true
    },
    type: (text) => {
      search += text
    },
    backspace: () => {
      if (search === '') return false
      search = search.slice(0, -1)
      return true
    }
  }
  const { view, reports } = openView(marked, undefined, { extensions: [liveTodoHelper(bridge)] })
  // jsdom has no layout: say where a position is on the screen.
  view.coordsAtPos = (pos) => ({ left: pos, right: pos, top: 0, bottom: pos + 20 })
  return {
    view,
    reports,
    opened,
    keys,
    searched: () => search,
    closed: () => closed,
    isOpen: () => open,
    setOpen: (value) => (open = value),
    type: (letter) => {
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: letter },
        selection: EditorSelection.cursor(from + letter.length),
        userEvent: 'input.type'
      })
    },
    press: (key, mods = {}) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods })
      view.contentDOM.dispatchEvent(event)
      return { prevented: event.defaultPrevented }
    }
  }
}

const todos = (text: string): (string[] | string)[][] =>
  parseTodos(text).map((t) => [t.owners, t.text])

describe('writing a TODO', () => {
  it('writes a bold TODO(XX) and a colon, puts the cursor after, and the text typed next is the TODO text', () => {
    const { view, type } = harness('Discussed weights.\n\n|')
    insertTodoText(view, view.state.selection.main.from, view.state.selection.main.from, 'EO')
    expect(show(view)).toBe('Discussed weights.\n\n**TODO(EO)**: |')
    for (const letter of 'Re-run') type(letter)
    expect(todos(view.state.sliceDoc())).toEqual([[['EO'], 'Re-run']])
  })
  it('writes **TODO**: for no owner', () => {
    const { view } = harness('|')
    insertTodoText(view, 0, 0, null)
    expect(show(view)).toBe('**TODO**: |')
    expect(parseTodos('**TODO**: x')[0]).toMatchObject({ owners: [] })
  })
  it('replaces the range it is given, such as the typed /todo, and one undo gives it back', () => {
    const { view } = harness('Point one /todo|')
    insertTodoText(view, 10, 15, 'KR')
    expect(show(view)).toBe('Point one **TODO(KR)**: |')
    undo(view)
    expect(view.state.sliceDoc()).toBe('Point one /todo')
  })
  it('works inside a bullet and keeps the note’s own line breaks', () => {
    const { view } = harness('- a\r\n- \r\n')
    // (A position in the document counts a CRLF break as one.)
    const at = view.state.doc.line(2).to
    view.dispatch({ selection: EditorSelection.cursor(at) })
    insertTodoText(view, at, at, 'AC')
    expect(view.state.sliceDoc()).toBe('- a\r\n- **TODO(AC)**: \r\n')
    expect(view.state.selection.main.from).toBe(at + '**TODO(AC)**: '.length)
  })
  it('reports the text at once, so quitting straight after writing it saves it', () => {
    const { view, reports } = harness('x |')
    insertTodoText(view, 2, 2, 'EO')
    expect(reports).toEqual(['x **TODO(EO)**: '])
  })
})

describe('typing /todo', () => {
  it('opens the menu over the whole /todo, at the start of it, and lets the letter through', async () => {
    const h = harness('Point one /tod|')
    h.type('o')
    await frame()
    expect(h.opened).toHaveLength(1)
    const request = h.opened[0]
    expect(h.view.state.sliceDoc(request.from, request.to)).toBe('/todo')
    expect(request.at).toMatchObject({ left: request.from, bottom: request.from + 20 })
    expect(h.view.state.sliceDoc()).toBe('Point one /todo')
  })
  it('writes the TODO over the /todo when an owner is chosen', async () => {
    const h = harness('Point one /tod|')
    h.type('o')
    await frame()
    h.opened[0].insert('KR')
    expect(h.view.state.sliceDoc()).toBe('Point one **TODO(KR)**: ')
  })
  it('works at the very start of a line and in a bullet', async () => {
    for (const marked of ['/tod|', '- /tod|', 'a\n\n/tod|']) {
      const h = harness(marked)
      h.type('o')
      await frame()
      expect(h.opened, marked).toHaveLength(1)
    }
  })
  it('does not open when the letter replaces a selection', async () => {
    const h = harness('/tod|X|')
    h.type('o')
    await frame()
    expect(h.opened).toHaveLength(0)
  })
  it('does not open inside a word, on other letters, or in code', async () => {
    for (const marked of ['a/tod|', '/to|', '`/tod|`', '```\n/tod|\n```']) {
      const h = harness(marked)
      h.type(marked.includes('/to|') ? 'd' : 'o')
      await frame()
      expect(h.opened, marked).toHaveLength(0)
    }
  })
  it('does not open for a pasted /todo, only for a typed letter', async () => {
    const h = harness('|')
    h.view.dispatch({ changes: { from: 0, insert: '/todo' }, userEvent: 'input.paste' })
    await frame()
    expect(h.opened).toHaveLength(0)
  })
  it('does not open for one letter that arrives as a paste or at several cursors at once', async () => {
    const pasted = harness('/tod|')
    pasted.view.dispatch({ changes: { from: 4, insert: 'o' }, userEvent: 'input.paste' })
    await frame()
    expect(pasted.opened).toHaveLength(0)
    const several = harness('a /tod|')
    several.view.dispatch({
      changes: [
        { from: 0, insert: 'b' },
        { from: 6, insert: 'o' }
      ],
      selection: EditorSelection.cursor(8),
      userEvent: 'input.type'
    })
    await frame()
    expect(several.opened).toHaveLength(0)
  })
  it('does not open when more was typed before the menu could appear', async () => {
    const h = harness('/tod|')
    h.type('o')
    h.type('x')
    await frame()
    expect(h.opened).toHaveLength(0)
  })
})

describe('keys', () => {
  it('Cmd/Ctrl+Shift+T opens the menu at the cursor, or over the selection, and is handled', () => {
    const h = harness('te|xt')
    expect(h.press('T', { metaKey: true, shiftKey: true })).toEqual({ prevented: true })
    expect(h.opened[0]).toMatchObject({ from: 2, to: 2, at: { left: 2, bottom: 22 } })
    h.setOpen(false)
    h.view.dispatch({ selection: EditorSelection.range(0, 4) })
    h.press('t', { ctrlKey: true, shiftKey: true })
    expect(h.opened[1]).toMatchObject({ from: 0, to: 4 })
  })
  it('does nothing for plain T or Cmd+T', () => {
    const h = harness('text|')
    expect(h.press('t').prevented).toBe(false)
    expect(h.press('t', { metaKey: true }).prevented).toBe(false)
    expect(h.opened).toHaveLength(0)
  })
  it('while open, arrows, Enter, Tab and Escape go to the menu and not to the note', () => {
    const h = harness('text|')
    h.setOpen(true)
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'])
      expect(h.press(key), key).toEqual({ prevented: true })
    expect(h.keys).toEqual(['down', 'up', 'enter', 'enter', 'escape'])
  })
  it('while open, a character goes to the menu search and not to the note', () => {
    const h = harness('text|')
    h.setOpen(true)
    expect(h.press('a').prevented).toBe(true)
    expect(h.press('b').prevented).toBe(true)
    expect(h.searched()).toBe('ab')
    expect(h.isOpen()).toBe(true)
    // Backspace takes back a typed letter...
    expect(h.press('Backspace').prevented).toBe(true)
    expect(h.searched()).toBe('a')
    h.press('Backspace')
    // ...and on an empty search it closes the menu and is left to the note.
    h.press('Backspace')
    expect(h.isOpen()).toBe(false)
    expect(h.reports.at(-1)).toBe('tex')
  })
  it('a shortcut chord is not searched', () => {
    const h = harness('text|')
    h.setOpen(true)
    h.press('a', { metaKey: true })
    expect(h.searched()).toBe('')
  })
  it('while closed, Enter, Tab and the arrows never reach the menu', () => {
    const h = harness('text|')
    for (const key of ['Enter', 'Tab', 'ArrowDown', 'Escape']) h.press(key)
    expect(h.keys).toEqual([])
  })
})

describe('closing', () => {
  it('closes when the note changes or the cursor moves, but not for a change that is not there', async () => {
    const h = harness('a /tod|')
    h.type('o')
    await frame()
    expect(h.isOpen()).toBe(true)
    h.view.dispatch({ selection: EditorSelection.cursor(0) })
    expect(h.isOpen()).toBe(false)
    h.setOpen(true)
    h.view.dispatch({ changes: { from: 0, insert: 'z' } })
    expect(h.isOpen()).toBe(false)
  })
  it('closes when the editor goes', () => {
    const h = harness('text|')
    h.setOpen(true)
    h.view.destroy()
    expect(h.isOpen()).toBe(false)
  })
  it('choosing an owner writes the TODO and the menu stays closed', async () => {
    const h = harness('/tod|')
    h.type('o')
    await frame()
    const request = h.opened[0]
    h.setOpen(false) // the menu closes itself before it writes
    request.insert('EO')
    expect(h.view.state.sliceDoc()).toBe('**TODO(EO)**: ')
    expect(h.isOpen()).toBe(false)
  })
})
