// @vitest-environment jsdom
import { undo, undoDepth } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import type { EntityHost } from '../entities/mention-target'
import { liveFindTarget } from './live-find'
import { openView, press } from './live-key-utils'
import { findMatches } from './live-history.testing'
import { toggleTaskAt } from './live-widgets'

/** What one undo step is worth, for every command of the editor: one key is one step, never stuck to the typing round it. */

const KATHY = '[Kathy](cc://person/Kathy)'
const host: EntityHost = {
  resolve: () => ({ state: 'pending' }),
  suggest: () => undefined,
  handleKey: () => false,
  detach: () => undefined
}

/** Typing a letter at the very start of the note: what the keyboard does, and it moves no cursor elsewhere. */
const typeAtStart = (view: EditorView, letter: string): void =>
  view.dispatch({ changes: { from: 0, insert: letter }, userEvent: 'input.type' })

interface Scenario {
  name: string
  doc: string
  /** Does the command: a chord, or a function for the ones a click or another part of the app makes. */
  act: string | ((view: EditorView) => void)
  entities?: boolean
  /** What marks the cursor, when `|` is part of the text. */
  cursor?: string
}

const scenarios: Scenario[] = [
  { name: 'bold', doc: 'a |word| here', act: 'Mod-b' },
  { name: 'italic on a word', doc: 'a wo|rd here', act: 'Mod-i' },
  { name: 'strike', doc: 'a |word| here', act: 'Mod-Alt-x' },
  { name: 'code', doc: 'a |word| here', act: 'Mod-e' },
  { name: 'heading', doc: 'plain|', act: 'Mod-Alt-2' },
  { name: 'paragraph', doc: '## plain|', act: 'Mod-Alt-0' },
  { name: 'bullets over lines', doc: '|one\ntwo|', act: 'Mod-Alt-8' },
  { name: 'numbers over lines', doc: '|one\ntwo|', act: 'Mod-Alt-7' },
  { name: 'quote', doc: 'plain|', act: 'Mod-Shift-b' },
  { name: 'code block', doc: 'plain|', act: 'Mod-Alt-c' },
  { name: 'Enter in a list', doc: '- item|', act: 'Enter' },
  { name: 'Enter on an empty item', doc: '- item\n- |', act: 'Enter' },
  { name: 'Enter in a numbered list (renumbers)', doc: '1. a|\n2. b\n3. c', act: 'Enter' },
  { name: 'Shift-Enter', doc: '- item|', act: 'Shift-Enter' },
  { name: 'Backspace at the start of an item', doc: '- one\n- |two', act: 'Backspace' },
  { name: 'Delete at the end of the line before an item', doc: 'intro|\n- one', act: 'Delete' },
  { name: 'Tab nests', doc: '- one\n- |two', act: 'Tab' },
  { name: 'Shift-Tab outdents', doc: '- one\n  - |two', act: 'Shift-Tab' },
  { name: 'Mod-] nests', doc: '- one\n- |two', act: 'Mod-]' },
  { name: 'Mod-[ outdents', doc: '- one\n  - |two', act: 'Mod-[' },
  {
    name: 'Tab in the last cell adds a row',
    doc: '| a | b |\n|---|---|\n| 1 | 2¦|',
    act: 'Tab',
    cursor: '¦'
  },
  {
    name: 'a checkbox click',
    doc: '- [ ] task',
    act: (view) => toggleTaskAt(view, view.state.doc.line(3).from)
  },
  {
    name: 'Backspace over a mention',
    doc: `a ${KATHY}|`,
    act: 'Backspace',
    entities: true
  },
  {
    name: 'Delete before a mention',
    doc: `a |${KATHY}`,
    act: 'Delete',
    entities: true
  },
  {
    name: 'Replace in the find bar',
    doc: 'one| two one',
    act: (view) => {
      const target = liveFindTarget(view)
      target.replace(findMatches(view, 'one')[0], 'ONE')
    }
  },
  {
    name: 'Replace all in the find bar',
    doc: 'one two one|',
    act: (view) => {
      const target = liveFindTarget(view)
      target.replaceAll(findMatches(view, 'one'), 'ONE')
    }
  },
  {
    name: 'a chosen mention or owner (input.complete)',
    doc: 'a @k|',
    act: (view) =>
      view.dispatch({
        changes: {
          from: view.state.doc.line(3).from + 2,
          to: view.state.doc.line(3).to,
          insert: KATHY
        },
        userEvent: 'input.complete'
      })
  },
  {
    name: 'a paste',
    doc: 'a |b| c',
    act: (view) =>
      view.dispatch({
        changes: {
          from: view.state.selection.main.from,
          to: view.state.selection.main.to,
          insert: 'PASTED'
        },
        userEvent: 'input.paste'
      })
  }
]

describe('undo: one command is one step, not stuck to the typing before or after it', () => {
  for (const scenario of scenarios) {
    it(scenario.name, () => {
      // A first line to type on, so the typing never changes what the command reads.
      const { view } = openView(
        `intro\n\n${scenario.doc}`,
        scenario.entities ? { host, open: () => undefined } : undefined,
        { cursor: scenario.cursor }
      )
      const original = view.state.sliceDoc()
      const run = (): void => {
        if (typeof scenario.act === 'string')
          expect(press(view, scenario.act), `${scenario.act} is handled`).toBe(true)
        else scenario.act(view)
      }

      // Typed just before (same instant: well inside the history's grouping time).
      typeAtStart(view, 'a')
      const afterA = view.state.sliceDoc()
      const depth = undoDepth(view.state)
      run()
      const afterCommand = view.state.sliceDoc()
      expect(afterCommand, 'the command changed something').not.toBe(afterA)
      expect(undoDepth(view.state), 'one step more for the command').toBe(depth + 1)
      // Typed straight after, where the cursor is now: next to what the command changed, which is where history would join them.
      const head = view.state.selection.main.head
      view.dispatch({
        changes: { from: head, insert: 'b' },
        selection: { anchor: head + 1 },
        userEvent: 'input.type'
      })
      expect(undoDepth(view.state), 'typing afterwards is its own step').toBe(depth + 2)

      undo(view)
      expect(view.state.sliceDoc(), 'first undo takes back the typing after').toBe(afterCommand)
      undo(view)
      expect(view.state.sliceDoc(), 'second undo takes back exactly the command').toBe(afterA)
      undo(view)
      expect(view.state.sliceDoc(), 'third undo takes back the typing before').toBe(original)
    })
  }

  it('does not split a burst of typing, nor the ordinary Backspace that corrects it', () => {
    const { view } = openView('')
    for (const letter of 'hello')
      view.dispatch({
        changes: { from: view.state.doc.length, insert: letter },
        selection: { anchor: view.state.doc.length + 1 },
        userEvent: 'input.type'
      })
    expect(undoDepth(view.state)).toBe(1)
    view.dispatch({ changes: { from: 4, to: 5 }, userEvent: 'delete.backward' })
    expect(undoDepth(view.state)).toBe(1)
  })

  it('is not stuck to the typing right before it either (the dash and space just typed, then Backspace)', () => {
    const { view } = openView('intro\n\n|')
    for (const letter of ['-', ' ']) {
      const head = view.state.selection.main.head
      view.dispatch({
        changes: { from: head, insert: letter },
        selection: { anchor: head + 1 },
        userEvent: 'input.type'
      })
    }
    expect(view.state.sliceDoc()).toBe('intro\n\n- ')
    const depth = undoDepth(view.state)
    expect(press(view, 'Backspace')).toBe(true)
    expect(view.state.sliceDoc()).toBe('intro\n\n')
    expect(undoDepth(view.state)).toBe(depth + 1)
    undo(view)
    expect(view.state.sliceDoc()).toBe('intro\n\n- ')
  })

  it('is not stuck to the typing right before a mention is deleted', () => {
    const { view } = openView(`a |${KATHY}`, { host, open: () => undefined })
    view.dispatch({
      changes: { from: 2, insert: 'x' },
      selection: { anchor: 3 },
      userEvent: 'input.type'
    })
    const depth = undoDepth(view.state)
    expect(press(view, 'Delete')).toBe(true)
    expect(view.state.sliceDoc()).toBe('a x')
    expect(undoDepth(view.state)).toBe(depth + 1)
    undo(view)
    expect(view.state.sliceDoc()).toBe(`a x${KATHY}`)
  })
})
