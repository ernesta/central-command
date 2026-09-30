// @vitest-environment jsdom
import { undo } from '@codemirror/commands'
import { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { NotesFindController } from '../notes/useNotesFind'
import { findInDoc } from './live-find'
import { openView, press, show } from './live-key-utils'

/** A note in a real editor with the real find controller behind Cmd-F, as `EditorCard` wires them. */
function withBar(marked: string): {
  view: EditorView
  bar: NotesFindController
  reports: string[]
  opened: boolean[]
  closed: number[]
} {
  const opened: boolean[] = []
  const closed: number[] = []
  const bar = new NotesFindController(
    (replace) => opened.push(replace),
    () => closed.push(1)
  )
  const { view, reports } = openView(marked, undefined, { find: bar })
  return { view, bar, reports, opened, closed }
}

const words = (text: string): { from: number; to: number }[] =>
  findInDoc(Text.of(text.split('\n')), 'x')

/** What the editor draws as find matches: text and whether it is the current one. */
function highlighted(view: EditorView): { text: string; active: boolean }[] {
  return [...view.dom.querySelectorAll<HTMLElement>('.notes-find-match, .notes-find-active')].map(
    (el) => ({ text: el.textContent ?? '', active: el.classList.contains('notes-find-active') })
  )
}

describe('finding in the text', () => {
  const find = (text: string, query: string): string[] =>
    findInDoc(Text.of(text.split('\n')), query).map((m) =>
      text.split('\n').join('\n').slice(m.from, m.to)
    )

  it('ignores case and finds a word inside bold or a link label, since it reads the Markdown', () => {
    expect(find('One **bold** and [link](https://x.org) BOLD', 'bold')).toEqual(['bold', 'BOLD'])
    expect(find('a [Kathy](cc://person/k) b', 'kathy')).toEqual(['Kathy'])
  })
  it('matches markers when the query is only markers, and words in addresses (recorded in DECISIONS.md)', () => {
    expect(find('**a** and **b**', '**')).toHaveLength(4)
    expect(find('# One\n## Two', '#')).toHaveLength(3)
    expect(find('[t](https://example.org)', 'example')).toEqual(['example'])
  })
  it('returns positions in the document, over several lines', () => {
    const doc = Text.of(['ab cd', 'cd ef'])
    expect(findInDoc(doc, 'cd')).toEqual([
      { from: 3, to: 5 },
      { from: 6, to: 8 }
    ])
  })
  it('never overlaps matches, so replace-all is separate edits', () => {
    expect(findInDoc(Text.of(['aaaa']), 'aa')).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 }
    ])
    expect(findInDoc(Text.of(['aaa']), 'aa')).toHaveLength(1)
  })
  it('ignores the white space round the query, and finds nothing for an empty one', () => {
    expect(find('a b', ' b ')).toEqual(['b'])
    expect(findInDoc(Text.of(['a b']), '  ')).toEqual([])
    expect(findInDoc(Text.of(['a b']), '')).toEqual([])
  })
  it('keeps positions right after a letter whose lower case is longer (İ)', () => {
    const doc = Text.of(['İ x'])
    expect(findInDoc(doc, 'x')).toEqual([{ from: 2, to: 3 }])
  })
  it('counts a CRLF break as one position, as the document does', () => {
    const { view } = openView('one\r\ntwo x')
    expect(findInDoc(view.state.doc, 'x')).toEqual([{ from: 8, to: 9 }])
    expect(view.state.sliceDoc(8, 9)).toBe('x')
    expect(words('x')).toHaveLength(1)
  })
})

describe('Cmd-F and Cmd-Option-F', () => {
  it('open the bar (Cmd-Option-F with the replace row) and are handled', () => {
    const one = withBar('hello')
    expect(press(one.view, 'Mod-f')).toBe(true)
    expect(one.opened).toEqual([false])
    const two = withBar('hello')
    expect(press(two.view, 'Mod-Alt-f')).toBe(true)
    expect(two.opened).toEqual([true])
  })
  it('do nothing while the bar is open (as with the old editor)', () => {
    const { view, opened } = withBar('hello')
    press(view, 'Mod-f')
    expect(press(view, 'Mod-f')).toBe(false)
    expect(opened).toEqual([false])
  })
  it('are not handled by an editor with no bar', () => {
    const { view } = openView('hello')
    expect(press(view, 'Mod-f')).toBe(false)
  })
  it('do not change the text or the selection', () => {
    const { view } = withBar('he|llo')
    press(view, 'Mod-f')
    expect(show(view)).toBe('he|llo')
  })
})

describe('the matches on screen', () => {
  it('are drawn, the current one stronger, and go when the bar closes', () => {
    const { view, bar } = withBar('a **Cat** and a cat')
    press(view, 'Mod-f')
    bar.search('cat')
    expect(highlighted(view)).toEqual([
      { text: 'Cat', active: true },
      { text: 'cat', active: false }
    ])
    bar.move(1)
    expect(highlighted(view).map((h) => h.active)).toEqual([false, true])
    bar.close()
    expect(highlighted(view)).toEqual([])
  })
  it('follow the text when the note is edited while the bar is open', () => {
    const { view, bar } = withBar('cat and cat')
    press(view, 'Mod-f')
    bar.search('cat')
    view.dispatch({ changes: { from: 0, insert: 'the ' } })
    expect(highlighted(view).map((h) => h.text)).toEqual(['cat', 'cat'])
    expect(view.state.sliceDoc(4, 7)).toBe('cat')
  })
  it('never change the document, and the bar closing on a destroyed editor leaves it alone', () => {
    const { view, bar, reports, closed } = withBar('cat')
    press(view, 'Mod-f')
    bar.search('cat')
    expect(reports).toEqual([])
    view.destroy()
    expect(closed).toEqual([1])
    expect(bar.isOpen()).toBe(false)
  })
})

describe('replacing', () => {
  it('replaces the current match and moves on, inside markers too', () => {
    const { view, bar, reports } = withBar('**bold** and bold')
    press(view, 'Mod-Alt-f')
    bar.search('bold')
    bar.replaceOne('plain', 'bold')
    expect(view.state.sliceDoc()).toBe('**plain** and bold')
    expect(bar.matches).toHaveLength(1)
    expect(reports.at(-1)).toBe('**plain** and bold')
    bar.replaceOne('plain', 'bold')
    expect(view.state.sliceDoc()).toBe('**plain** and plain')
    expect(bar.matches).toHaveLength(0)
  })
  it('replaces every match at once, as one undo step', () => {
    const { view, bar, reports } = withBar('a cat, a **cat**, a CAT\nsecond cat')
    press(view, 'Mod-Alt-f')
    bar.search('cat')
    bar.replaceAll('dog', 'cat')
    expect(view.state.sliceDoc()).toBe('a dog, a **dog**, a dog\nsecond dog')
    expect(reports).toHaveLength(1)
    undo(view)
    expect(view.state.sliceDoc()).toBe('a cat, a **cat**, a CAT\nsecond cat')
  })
  it('makes each single replacement its own undo step, even when done in a moment', () => {
    const { view, bar } = withBar('cat cat')
    press(view, 'Mod-Alt-f')
    bar.search('cat')
    bar.replaceOne('x', 'cat')
    bar.replaceOne('y', 'cat')
    expect(view.state.sliceDoc()).toBe('x y')
    undo(view)
    expect(view.state.sliceDoc()).toBe('x cat')
    undo(view)
    expect(view.state.sliceDoc()).toBe('cat cat')
  })
  it('does not join two neighbouring replacements into one undo step', () => {
    const { view, bar } = withBar('catcat')
    press(view, 'Mod-Alt-f')
    bar.search('cat')
    bar.replaceOne('x', 'cat')
    bar.replaceOne('y', 'cat')
    expect(view.state.sliceDoc()).toBe('xy')
    undo(view)
    expect(view.state.sliceDoc()).toBe('xcat')
  })
  it('can replace with nothing, or with markers, and changes nothing else', () => {
    const { view, bar } = withBar('keep [a](u) keep')
    press(view, 'Mod-Alt-f')
    bar.search('keep')
    bar.replaceAll('', 'keep')
    expect(view.state.sliceDoc()).toBe(' [a](u) ')
  })
  it('finds again before replacing, so text changed under the bar is never replaced by position', () => {
    const { view, bar } = withBar('cat dog cat')
    press(view, 'Mod-Alt-f')
    bar.search('cat')
    // The bar's copy of the matches is now out of date (the note was edited behind it).
    bar.matches = [
      { from: 0, to: 3 },
      { from: 8, to: 11 }
    ]
    view.dispatch({ changes: { from: 0, insert: 'a big ' } })
    bar.active = 0
    bar.replaceOne('mouse', 'cat')
    expect(view.state.sliceDoc()).toBe('a big mouse dog cat')
    bar.replaceAll('mouse', 'cat')
    expect(view.state.sliceDoc()).toBe('a big mouse dog mouse')
  })
  it('finds again before replacing all, too', () => {
    const { view, bar } = withBar('cat dog cat')
    press(view, 'Mod-Alt-f')
    bar.search('cat')
    view.dispatch({ changes: { from: 0, insert: 'a big ' } })
    // The bar's copy still says 0–3 and 8–11: replacing by those would eat 'a b' and 'dog'.
    bar.replaceAll('mouse', 'cat')
    expect(view.state.sliceDoc()).toBe('a big mouse dog mouse')
  })
  it('keeps the note’s own line breaks (CRLF)', () => {
    const { view, bar } = withBar('a cat\r\nb cat\r\n')
    press(view, 'Mod-Alt-f')
    bar.search('cat')
    bar.replaceAll('dog', 'cat')
    expect(view.state.sliceDoc()).toBe('a dog\r\nb dog\r\n')
  })
  it('reports the text at once, so quitting straight after a replace saves it', () => {
    const { view, bar, reports } = withBar('cat')
    press(view, 'Mod-Alt-f')
    bar.search('cat')
    bar.replaceAll('dog', 'cat')
    expect(reports).toEqual(['dog'])
  })
})

describe('Cmd-Enter and Cmd-Shift-Enter in the note', () => {
  function ready(): ReturnType<typeof withBar> & { calls: boolean[] } {
    const base = withBar('cat cat cat')
    const calls: boolean[] = []
    press(base.view, 'Mod-Alt-f')
    base.bar.search('cat')
    base.bar.replaceKey = (all) => {
      calls.push(all)
      if (all) base.bar.replaceAll('dog', 'cat')
      else base.bar.replaceOne('dog', 'cat')
    }
    return { ...base, calls }
  }
  it('replace this match, or every match, when the bar shows its replace row', () => {
    const { view, calls } = ready()
    expect(press(view, 'Mod-Enter')).toBe(true)
    expect(view.state.sliceDoc()).toBe('dog cat cat')
    expect(press(view, 'Mod-Shift-Enter')).toBe(true)
    expect(view.state.sliceDoc()).toBe('dog dog dog')
    expect(calls).toEqual([false, true])
  })
  it('leave the note alone when the replace row is hidden', () => {
    const { view, bar } = ready()
    bar.replaceKey = null
    expect(press(view, 'Mod-Shift-Enter')).toBe(false)
    expect(view.state.sliceDoc()).toBe('cat cat cat')
  })
  it('are not ours when no bar is open (Cmd-Enter keeps its usual meaning)', () => {
    const { view } = withBar('cat')
    expect(press(view, 'Mod-Shift-Enter')).toBe(false)
  })
})
