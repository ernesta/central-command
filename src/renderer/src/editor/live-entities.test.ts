// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import { describe, expect, it } from 'vitest'
import type { EntityRef } from '@shared/entities'
import type { EntityHost, MentionTarget, Suggestion } from '../entities/mention-target'
import { chipOf, deleteChip, findSuggestion, liveTarget, type LiveEntities } from './live-entities'
import { liveKeymap } from './live-keymap'
import { openView, press, show } from './live-key-utils'
import { decorationsOf, stateFor } from './live-test-utils'

const KATHY = '[Kathy Rastle](cc://person/Kathy%20Rastle)'
const PAPER = '[Smith 2020](cc://reading/smith2020)'

/** A host that records what the editor tells it, and answers `resolve` from `missing`. */
function fakeHost(over: Partial<EntityHost> = {}): {
  entities: LiveEntities
  suggested: (Suggestion | null)[]
  opened: EntityRef[]
  targets: MentionTarget[]
} {
  const suggested: (Suggestion | null)[] = []
  const targets: MentionTarget[] = []
  const opened: EntityRef[] = []
  const host: EntityHost = {
    resolve: () => ({ state: 'pending' }),
    suggest: (target, suggestion) => {
      targets.push(target)
      suggested.push(suggestion)
    },
    handleKey: () => false,
    detach: () => undefined,
    ...over
  }
  return { entities: { host, open: (ref) => opened.push(ref) }, suggested, opened, targets }
}

/** The editor measures on the next frame; that is when it tells the picker where the cursor is. */
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

const chips = (view: EditorView): HTMLElement[] => [
  ...view.dom.querySelectorAll<HTMLElement>('.live-chip')
]

describe('a mention is drawn as a chip', () => {
  it('replaces exactly the whole [label](address), whatever the cursor does', () => {
    const text = `See ${KATHY} and ${PAPER}.`
    for (const at of [0, 6, text.indexOf('Kathy') + 2, text.length]) {
      const state = stateFor(text, at)
      const widgets = decorationsOf(state).filter((seen) => seen.kind === 'widget')
      expect(
        widgets.map((w) => state.doc.sliceString(w.from, w.to)),
        `cursor ${at}`
      ).toEqual([KATHY, PAPER])
      // Nothing else is hidden or shown as a marker inside them.
      for (const seen of decorationsOf(state))
        if (seen.kind !== 'widget')
          for (const w of widgets)
            expect(seen.from >= w.to || seen.to <= w.from, `${seen.kind} ${seen.from}`).toBe(true)
    }
  })

  it('reads the label without the backslashes of escaped brackets', () => {
    const state = stateFor('a [x \\[1\\]](cc://note/k3f9a2x1) b')
    const node = state.doc.toString().indexOf('[x')
    let found: ReturnType<typeof chipOf> = null
    syntaxTree(state).iterate({
      enter(n) {
        if (n.name === 'Link') found = chipOf(state, n.node)
      }
    })
    expect(node).toBe(2)
    expect(found).toMatchObject({ label: 'x [1]', ref: { kind: 'note', key: 'k3f9a2x1' } })
  })

  it.each([
    ['a web link', 'See [web](https://x.org) now'],
    ['an empty label', 'See [](cc://person/Kathy) now'],
    ['a title', 'See [Kathy](cc://person/Kathy "title") now'],
    ['an unknown kind', 'See [Kathy](cc://task/1) now'],
    ['inline code', 'See `[Kathy](cc://person/Kathy)` now'],
    ['two lines', 'See [Kathy\nRastle](cc://person/Kathy) now']
  ])('is not made of %s', (_name, text) => {
    expect(decorationsOf(stateFor(text)).filter((seen) => seen.kind === 'widget')).toEqual([])
  })

  it('shows the label with the icon of its kind, and marks one whose target is gone', () => {
    const { entities } = fakeHost({
      resolve: (ref) => (ref.kind === 'reading' ? { state: 'missing' } : { state: 'pending' })
    })
    const { view } = openView(`${KATHY} ${PAPER}`, entities)
    expect(
      chips(view).map((c) => [c.textContent, c.dataset.kind, c.dataset.key, c.dataset.missing])
    ).toEqual([
      ['Kathy Rastle', 'person', 'Kathy Rastle', undefined],
      ['Smith 2020', 'reading', 'smith2020', 'true']
    ])
    expect(chips(view)[0].style.getPropertyValue('--entity-icon')).toBe('var(--entity-icon-person)')
  })

  it('is drawn again when what it points at has been looked up', () => {
    let missing = false
    const { entities } = fakeHost({
      resolve: () => (missing ? { state: 'missing' } : { state: 'pending' })
    })
    const { view } = openView(KATHY, entities)
    expect(chips(view)[0].dataset.missing).toBeUndefined()
    missing = true
    liveTarget(view).refresh()
    expect(chips(view)[0].dataset.missing).toBe('true')
    expect(view.state.sliceDoc()).toBe(KATHY)
  })

  it('opens what it points at on Cmd-click, and a plain click leaves it to the editor', () => {
    const { entities, opened } = fakeHost()
    const { view } = openView(`${KATHY}${PAPER}`, entities)
    const [kathy, paper] = chips(view)
    const click = (el: HTMLElement, init: MouseEventInit): MouseEvent => {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, ...init })
      el.dispatchEvent(event)
      return event
    }
    expect(click(paper, { metaKey: true }).defaultPrevented).toBe(true)
    expect(click(kathy, { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(opened.map((r) => r.key)).toEqual(['smith2020', 'Kathy Rastle'])
    click(kathy, {})
    expect(opened).toHaveLength(2)
  })
})

describe('a chip is one thing to the cursor and to Backspace', () => {
  it('Backspace right after it removes the whole mention, and one undo brings it back', () => {
    const { view } = openView(`a ${KATHY}| b`)
    expect(press(view, 'Backspace')).toBe(true)
    expect(show(view)).toBe('a | b')
    undo(view)
    expect(view.state.sliceDoc()).toBe(`a ${KATHY} b`)
  })

  it('Delete right before it removes the whole mention', () => {
    const { view } = openView(`a |${KATHY} b`)
    expect(press(view, 'Delete')).toBe(true)
    expect(show(view)).toBe('a | b')
  })

  it('takes only the space first when the mention is followed by one', () => {
    const { view } = openView(`${KATHY} |x`)
    press(view, 'Backspace')
    expect(show(view)).toBe(`${KATHY}|x`)
    press(view, 'Backspace')
    expect(show(view)).toBe('|x')
  })

  it('removes neighbouring mentions one at a time', () => {
    const { view } = openView(`${KATHY}${PAPER}|`)
    press(view, 'Backspace')
    expect(show(view)).toBe(`${KATHY}|`)
  })

  it('leaves a selection, a mid-word position and other links to the ordinary keys', () => {
    for (const marked of [
      `|${KATHY}|`,
      'ab|c',
      '[web](https://x.org)|',
      `${KATHY.slice(0, 5)}|${KATHY.slice(5)}`
    ]) {
      const { view } = openView(marked)
      expect(deleteChip(false)(view), marked).toBe(false)
    }
    const { view } = openView(`${KATHY}|`)
    expect(deleteChip(true)(view)).toBe(false)
    const middle = openView(`${KATHY.slice(0, 5)}|${KATHY.slice(5)}`).view
    expect(deleteChip(true)(middle)).toBe(false)
  })

  it('is done by the keys of the editor themselves, with no other layer to fall back on', () => {
    // Only the live keymap and the Markdown parser: no default keymap, no atomic ranges, so it is our binding or nothing.
    const bare = (marked: string): EditorView => {
      const cursor = marked.indexOf('|')
      const view = new EditorView({
        parent: document.body.appendChild(document.createElement('div')),
        state: EditorState.create({
          doc: marked.replace('|', ''),
          selection: { anchor: cursor },
          extensions: [markdown({ base: markdownLanguage, addKeymap: false }), liveKeymap]
        })
      })
      ensureSyntaxTree(view.state, view.state.doc.length, 10_000)
      return view
    }
    const back = bare(`x ${KATHY}|`)
    expect(press(back, 'Backspace')).toBe(true)
    expect(back.state.sliceDoc()).toBe('x ')
    const forward = bare(`|${KATHY} x`)
    expect(press(forward, 'Delete')).toBe(true)
    expect(forward.state.sliceDoc()).toBe(' x')
  })

  it('is stepped over by the arrow keys, and never entered', () => {
    const { view } = openView(`a|${KATHY}b`)
    const start = 1
    const end = 1 + KATHY.length
    press(view, 'ArrowRight')
    expect(view.state.selection.main.head).toBe(end)
    press(view, 'ArrowLeft')
    expect(view.state.selection.main.head).toBe(start)
  })

  it('Backspace with the ordinary keys alone (no chip command) still takes the whole mention', () => {
    // The atomic range is a second layer: it holds even for a key the chip command does not see.
    const { view } = openView(`${KATHY}|`)
    press(view, 'Mod-Backspace')
    expect(view.state.sliceDoc()).not.toContain('cc://')
  })
})

describe('the @ picker', () => {
  const at = (marked: string): Suggestion | null => {
    const { view } = openView(marked)
    return findSuggestion(view.state)
  }

  it.each([
    ['Met @|', ''],
    ['Met @kat|', 'kat'],
    ['@kat|', 'kat'],
    ['Met (@kat|', 'kat'],
    ['Met @kathy ras|', 'kathy ras'],
    ['- @kat|', 'kat'],
    ['> @kat|', 'kat'],
    ['## Met @kat|', 'kat']
  ])('finds the query in %j', (marked, query) => {
    const s = at(marked)
    expect(s?.query).toBe(query)
    const { view } = openView(marked)
    expect(view.state.sliceDoc(s!.from, s!.to)).toBe(`@${query}`)
  })

  it.each([
    'mail me a@b.org|',
    'meet @ noon|',
    'Met @kathy  ras|',
    `Met @${'x'.repeat(40)}|`,
    'no at sign|',
    '`code @kat|`',
    '`code @kat`|',
    '[a link @kat|](https://x.org)',
    '```\n@kat|\n```',
    'Met |@kat|'
  ])('finds nothing in %j', (marked) => {
    expect(at(marked)).toBeNull()
  })

  it('tells the picker on every change, with where the cursor is, and that it is gone when it goes', async () => {
    const { entities, suggested, targets } = fakeHost()
    document.hasFocus = () => true
    const { view } = openView('Met |', entities)
    // jsdom has no layout, so there is no cursor position to read: give it one.
    view.coordsAtPos = () => ({ left: 5, right: 5, top: 0, bottom: 10 })
    view.focus()
    expect(suggested).toEqual([null])
    view.dispatch({ changes: { from: 4, insert: '@ka' }, selection: { anchor: 7 } })
    await frame()
    expect(suggested.at(-1)).toMatchObject({ from: 4, to: 7, query: 'ka' })
    expect(targets.at(-1)?.current()?.query).toBe('ka')
    view.dispatch({ changes: { from: 7, insert: ' ' }, selection: { anchor: 8 } })
    view.dispatch({ changes: { from: 8, insert: 'x' }, selection: { anchor: 9 } })
    await frame()
    expect(suggested.at(-1)?.query).toBe('ka x')
    view.dispatch({ selection: { anchor: 0 } })
    await frame()
    expect(suggested.at(-1)).toBeNull()
  })

  it('writes the chosen mention in place of the @…, with a space after, in one undo step', () => {
    const { entities } = fakeHost()
    const { view } = openView('Met @ka| there', entities)
    const s = findSuggestion(view.state)!
    liveTarget(view).insert(s, 'Kathy Rastle', { kind: 'person', key: 'Kathy Rastle' })
    expect(show(view)).toBe(`Met ${KATHY} | there`)
    undo(view)
    expect(view.state.sliceDoc()).toBe('Met @ka there')
  })

  it('escapes brackets in a label so the mention stays one link', () => {
    const { view } = openView('@x|')
    liveTarget(view).insert(findSuggestion(view.state)!, 'A [b] c', {
      kind: 'note',
      key: 'k3f9a2x1'
    })
    expect(view.state.sliceDoc()).toBe('[A \\[b\\] c](cc://note/k3f9a2x1) ')
  })

  it('gives the picker the keys first while it is open, and the note gets none of them', () => {
    const keys: string[] = []
    const { entities } = fakeHost({ handleKey: (e) => (keys.push(e.key), e.key === 'Enter') })
    const { view } = openView('- a|', entities)
    const send = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      view.contentDOM.dispatchEvent(event)
      return event
    }
    // Enter would start a new item; the picker takes it instead.
    expect(send('Enter').defaultPrevented).toBe(true)
    expect(view.state.sliceDoc()).toBe('- a')
    send('ArrowDown')
    expect(keys).toEqual(['Enter', 'ArrowDown'])
  })
})

describe('punctuation right after a mention', () => {
  const type = (view: EditorView, text: string): boolean => {
    const { from, to } = view.state.selection.main
    return view.state
      .facet(EditorView.inputHandler)
      .some((handler) => handler(view, from, to, text, () => view.state.update({})))
  }

  it('takes back the space the mention was followed by', () => {
    const { view } = openView(`A ${KATHY} |and`)
    expect(type(view, ',')).toBe(true)
    expect(show(view)).toBe(`A ${KATHY},|and`)
    undo(view)
    expect(view.state.sliceDoc()).toBe(`A ${KATHY} and`)
  })

  it('leaves a space after ordinary text and after a web link alone, and other characters', () => {
    for (const marked of ['A word |and', 'A [web](https://x.org) |and']) {
      const { view } = openView(marked)
      expect(type(view, ','), marked).toBe(false)
    }
    const { view } = openView(`A ${KATHY} |and`)
    expect(type(view, 'x')).toBe(false)
  })
})
