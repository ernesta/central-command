import { undo } from '@codemirror/commands'
import type { EditorState, Transaction, TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { findMentions } from '@shared/entities'
import { splitNote } from '@shared/front-matter'
import { deleteChip, findSuggestion, liveTarget } from './live-entities'
import { formatBindings, listBindings } from './live-keymap'
import { parseLine } from './live-lines'
import { pasteText } from './live-paste'
import { computeReveal } from './live-reveal'
import { toggleTaskAt } from './live-widgets'
import { decorationsOf, stateFor } from './live-test-utils'

/**
 * The identity gate of the plan: every note of a real library, opened in the live editor, is the same text, an edit
 * changes only what was edited, and no cursor position lands inside hidden text. Point `LIVE_EDITOR_LIBRARY` at a COPY
 * of the notes folder (this is skipped when it is not set); nothing here writes anything.
 */
const root = process.env.LIVE_EDITOR_LIBRARY

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith('.md') ? [path] : []
  })
}

function checkNote(file: string, text: string): void {
  const state = stateFor(text)
  expect(state.sliceDoc(), file).toBe(text)

  // An edit at the start, the middle and the end leaves everything else byte-identical.
  for (const at of [0, Math.floor(text.length / 2), text.length]) {
    const edited = state.update({ changes: { from: at, insert: 'Ω' } }).state
    expect(edited.sliceDoc(), `${file} @${at}`).toBe(`${text.slice(0, at)}Ω${text.slice(at)}`)
  }

  // The cursor at a spread of positions: nothing hidden under it, and hidden text stays on one line.
  const step = Math.max(1, Math.floor(text.length / 80))
  for (let pos = 0; pos <= text.length; pos += step) {
    const here = stateFor(text, pos)
    for (const seen of decorationsOf(here)) {
      if (seen.kind !== 'hidden') continue
      expect(
        seen.from < pos && pos < seen.to,
        `${file}: cursor ${pos} inside hidden ${seen.from}-${seen.to}`
      ).toBe(false)
      expect(here.doc.lineAt(seen.from).number, file).toBe(here.doc.lineAt(seen.to).number)
    }
  }

  // The whole note selected: when that reaches across blocks, no marker shows.
  const all = stateFor(text, 0, text.length)
  if (computeReveal(all, true).none)
    expect(
      decorationsOf(all).filter((seen) => seen.kind === 'live-marker'),
      file
    ).toEqual([])
}

/**
 * What the text says once every character a key may add or take away is out of the way (markers, white space, digits:
 * `2016. Collected` split across a line is a number to a parser). No key may change what is left; a key that loses
 * or moves a word is a bug.
 */
function skeleton(text: string): string {
  return text.replace(/[\s*_~`\\#>\-+.)[\]0-9xX]/g, '')
}

/** Run a command headlessly: the transaction it dispatches, or null when it dispatched nothing. */
function run(
  command: (target: { state: EditorState; dispatch: (tr: Transaction) => void }) => boolean,
  state: EditorState
): { handled: boolean; tr: Transaction | null } {
  let tr: Transaction | null = null
  const handled = command({ state, dispatch: (t) => (tr = t) })
  return { handled, tr }
}

/**
 * Every key of the live editor, pressed at a spread of places in a real note, must keep the content, be undone in one
 * step to exactly the text before, and leave text well away from the cursor alone. (The cursor is at a point, and
 * then over the word there.)
 */
function checkKeys(file: string, text: string): void {
  const step = Math.max(1, Math.floor(text.length / 25))
  const bindings = [...formatBindings, ...listBindings]
  for (let pos = 0; pos <= text.length; pos += step) {
    const word = stateFor(text, pos).wordAt(pos)
    const selections = word ? [[pos], [word.from, word.to]] : [[pos]]
    for (const [anchor, head = anchor] of selections) {
      const state = stateFor(text, anchor, head)
      for (const binding of bindings) {
        const here = state.doc.lineAt(anchor)
        const parts = parseLine(here.text)
        const markerEnd = here.from + parts.quote.length + parts.indent.length + parts.marker.length
        // The marker of a heading or item is not text to make bold, and Enter over a selection replaces it: not the point here.
        if (
          /^Mod-(b|i|e|Alt-x)$/.test(binding.key as string) &&
          parts.marker !== '' &&
          anchor <= markerEnd
        )
          continue
        if (anchor !== head && /Enter$/.test(binding.key as string)) continue
        // In the middle of a marker (`#|# x`, `1|. x`) the cursor can be for a heading only; there Enter is plain text editing.
        if (parts.marker !== '' && anchor > here.from + parts.quote.length && anchor < markerEnd)
          continue
        const { tr } = run(binding.run as never, state)
        if (!tr || !tr.docChanged) continue
        const where = `${file} @${anchor}-${head} ${binding.key}`
        const after = tr.newDoc.sliceString(0)
        const [was, now] = [skeleton(text), skeleton(after)]
        let at = 0
        while (at < was.length && was[at] === now[at]) at += 1
        expect(now.slice(Math.max(0, at - 30), at + 30), where).toBe(
          was.slice(Math.max(0, at - 30), at + 30)
        )
        // Text before the cursor's line and after the next few lines is not touched (renumbering reaches further down).
        const line = state.doc.lineAt(anchor)
        if (binding.key !== 'Backspace' && binding.key !== 'Delete') {
          const keepFrom = Math.max(0, line.from - 1)
          expect(after.slice(0, keepFrom), `${where} (before)`).toBe(text.slice(0, keepFrom))
        }
        // One undo step gives back the note byte for byte.
        const undone = run(undo as never, tr.state)
        expect(undone.tr?.newDoc.sliceString(0), `${where} (undo)`).toBe(text)
      }
    }
  }
}

/** Drawn bullets, numbers and checkboxes cover exactly the marker, and a click on a checkbox changes one character. */
function checkList(file: string, text: string): void {
  const state = stateFor(text)
  for (const seen of decorationsOf(state)) {
    if (seen.kind !== 'widget') continue
    const line = state.doc.lineAt(seen.from)
    const parts = parseLine(line.text)
    expect(seen.from, `${file} widget start`).toBe(line.from + parts.quote.length)
    expect(seen.to, `${file} widget end`).toBe(
      line.from + parts.quote.length + parts.indent.length + parts.marker.length
    )
    if (parts.kind !== 'task') continue
    let after: string | null = null
    toggleTaskAt(
      {
        state,
        dispatch: (spec: TransactionSpec) => (after = state.update(spec).newDoc.sliceString(0))
      } as unknown as EditorView,
      seen.from
    )
    const changed = after as string | null
    expect(changed, file).not.toBeNull()
    let differing = 0
    for (let i = 0; i < text.length; i++) if (text[i] !== (changed as string)[i]) differing += 1
    expect(differing, `${file} checkbox`).toBe(1)
    expect((changed as string).length, file).toBe(text.length)
  }
}

/** Pasting a web address over a word makes it a link and changes nothing else; a plain paste inserts the text. */
function checkPaste(file: string, text: string): void {
  const step = Math.max(1, Math.floor(text.length / 10))
  for (let pos = 0; pos <= text.length; pos += step) {
    const word = stateFor(text, pos).wordAt(pos)
    if (!word || word.from === word.to) continue
    const state = stateFor(text, word.from, word.to)
    const done: string[] = []
    pasteText(
      {
        state,
        dispatch: (t: Transaction) => done.push(t.newDoc.sliceString(0))
      } as unknown as EditorView,
      'https://example.org/x',
      true
    )
    const label = text.slice(word.from, word.to)
    expect(done[0], file).toBe(
      `${text.slice(0, word.from)}[${label}](https://example.org/x)${text.slice(word.to)}`
    )
  }
}

const MENTION = '[Kathy Rastle](cc://person/Kathy%20Rastle)'

/**
 * Mentions among the real markup. The library has none yet, so a mention is written into each note at a spread of places
 * (as the picker would write it) and the editor must: draw it as one chip over exactly those characters or, where a
 * mention cannot be one (inside code or a link), leave it as text; take it away whole with Backspace, one undo giving the
 * note back byte for byte; and, for an `@` typed at the same places, offer the picker only where it belongs and put the
 * mention in exactly where the `@…` was. Mentions the library does have (found by the plain text scan, independent of the
 * parser) must each be a chip too.
 */
function checkMentions(file: string, text: string): { chips: number } {
  let chips = 0
  const widgetsOf = (state: EditorState): { from: number; to: number }[] =>
    decorationsOf(state).filter(
      (seen) => seen.kind === 'widget' && state.sliceDoc(seen.from, seen.to).includes('](cc://')
    )
  {
    const found = findMentions(text).map((m) => `${m.start}-${m.end}`)
    const drawn = widgetsOf(stateFor(text)).map((w) => `${w.from}-${w.to}`)
    // (A mention inside code is found by the scan of the text and rightly not drawn; the library has none.)
    for (const range of drawn) expect(found, `${file} chip ${range}`).toContain(range)
  }
  const step = Math.max(1, Math.floor(text.length / 25))
  for (let pos = 0; pos <= text.length; pos += step) {
    const word = stateFor(text, pos).wordAt(pos)
    const at = word ? word.from : pos
    const withChip = `${text.slice(0, at)}${MENTION}${text.slice(at)}`
    const state = stateFor(withChip, at + MENTION.length)
    const own = widgetsOf(state).filter((w) => w.from === at)
    for (const w of own) expect(w.to, `${file} @${at} chip end`).toBe(at + MENTION.length)
    // No two drawn units overlap, and none crosses a line.
    // (`between` reports in no particular order.)
    const units = decorationsOf(state)
      .filter((seen) => seen.kind === 'widget')
      .sort((a, b) => a.from - b.from)
    for (let i = 1; i < units.length; i++)
      expect(units[i].from >= units[i - 1].to, `${file} @${at} overlap`).toBe(true)
    for (const unit of units)
      expect(state.doc.lineAt(unit.from).number, `${file} @${at} line`).toBe(
        state.doc.lineAt(unit.to).number
      )
    if (own.length > 0) {
      chips += 1
      // Backspace right after the chip takes exactly the chip.
      let after: Transaction | null = null
      deleteChip(false)({
        state,
        dispatch: (spec: TransactionSpec) => (after = state.update(spec))
      } as unknown as EditorView)
      const removed = after as Transaction | null
      expect(removed?.newDoc.sliceString(0), `${file} @${at} backspace`).toBe(text)
      const undone = run(undo as never, (removed as Transaction).state)
      expect(undone.tr?.newDoc.sliceString(0), `${file} @${at} undo`).toBe(withChip)
    }
    // An `@…` typed here: offered only where it belongs, and replaced by exactly the mention and a space.
    const typed = `${text.slice(0, at)}@ka${text.slice(at)}`
    const typing = stateFor(typed, at + 3)
    const suggestion = findSuggestion(typing)
    if (suggestion) {
      expect(typing.sliceDoc(suggestion.from, suggestion.to), `${file} @${at} suggestion`).toBe(
        '@ka'
      )
      let result: string | null = null
      liveTarget({
        state: typing,
        dispatch: (spec: TransactionSpec) => (result = typing.update(spec).newDoc.sliceString(0)),
        focus: () => undefined
      } as unknown as EditorView).insert(suggestion, 'Kathy Rastle', {
        kind: 'person',
        key: 'Kathy Rastle'
      })
      expect(result, `${file} @${at} insert`).toBe(
        `${typed.slice(0, suggestion.from)}${MENTION} ${typed.slice(suggestion.to)}`
      )
    }
  }
  return { chips }
}

describe.skipIf(!root)('every note of a real library', () => {
  const files = root ? markdownFiles(root) : []

  it('has notes to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('opens as the same text, edits only where edited, and never hides text under the cursor', () => {
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      // The editors show the body; the whole file is checked too, in case a note is ever opened with its head.
      for (const text of [splitNote(whole).body, whole]) checkNote(file, text)
    }
  }, 600_000)

  it('runs every formatting and list key at a spread of places without losing content, and undoes in one step', () => {
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      checkKeys(file, splitNote(whole).body)
    }
  }, 1_200_000)

  it('draws every list marker as one unit exactly over the marker, and a checkbox click changes one character', () => {
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      checkList(file, splitNote(whole).body)
    }
  }, 600_000)

  it('draws a mention as one chip over exactly its text, removes it whole with Backspace, and offers @ only where it belongs', () => {
    let chips = 0
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      chips += checkMentions(file, splitNote(whole).body).chips
    }
    // A check that finds nothing to check proves nothing.
    expect(chips).toBeGreaterThan(files.length)
  }, 1_200_000)

  it('pastes a web address over a word as a link and changes nothing else', () => {
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      checkPaste(file, splitNote(whole).body)
    }
  }, 600_000)
})
