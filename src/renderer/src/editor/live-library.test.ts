import { undo } from '@codemirror/commands'
import type { EditorState, Transaction, TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { insertTodoText, todoTriggerAt } from './todo-live'
import { findMentions } from '@shared/entities'
import { splitNote } from '@shared/front-matter'
import { locatedOutline } from '@shared/markdown-outline'
import { wordCount, wordsOf } from '@shared/words'
import { deleteChip, findSuggestion, liveTarget } from './live-entities'
import { findInDoc, liveFindTarget } from './live-find'
import { toggleCodeBlock } from './live-format'
import { formatBindings, listBindings } from './live-keymap'
import { parseLine } from './live-lines'
import { headingStart } from './live-outline'
import { pasteText } from './live-paste'
import { computeReveal } from './live-reveal'
import { tableTab } from './live-tables'
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
  // (The one exception, on purpose: the opening fence of a code block that is never closed stays showing, since
  // everything below it is code and the note would look broken without the reason.)
  if (computeReveal(all, true).none)
    expect(
      decorationsOf(all).filter(
        (seen) =>
          seen.kind.split(' ')[0] === 'live-marker' &&
          !/^(`{3,}|~{3,})/.test(all.sliceDoc(seen.from, seen.to))
      ),
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

/** A view that only has a state and records what is dispatched: enough for the commands that read and write text. */
function fakeView(state: EditorState): { view: EditorView; last: () => Transaction | null } {
  let last: Transaction | null = null
  const view = {
    state,
    dispatch: (spec: TransactionSpec) => (last = state.update(spec)),
    focus: () => undefined
  } as unknown as EditorView
  return { view, last: () => last }
}

/**
 * Find and replace over the real markup. For a spread of words in each note: the matches are exactly those an independent
 * search (a regular expression over the text) finds, replace-all and replace-one give exactly the text with those stretches
 * replaced and nothing else, and one undo gives the note back byte for byte.
 */
function checkFind(file: string, text: string): { searched: number } {
  let searched = 0
  const step = Math.max(1, Math.floor(text.length / 25))
  for (let pos = 0; pos <= text.length; pos += step) {
    const state = stateFor(text, pos)
    const word = state.wordAt(pos)
    if (!word) continue
    const label = state.sliceDoc(word.from, word.to)
    if (!/^[\p{L}\p{N}]+$/u.test(label)) continue
    const doc = state.doc.toString()
    const expected = [...doc.matchAll(new RegExp(label, 'giu'))].map((m) => ({
      from: m.index,
      to: m.index + m[0].length
    }))
    const found = findInDoc(state.doc, label)
    expect(found, `${file} find "${label}"`).toEqual(expected)
    searched += 1
    expect(found.length, file).toBeGreaterThan(0)

    const replaceWith = (ranges: { from: number; to: number }[], insert: string): string =>
      ranges.reduceRight((out, r) => out.slice(0, r.from) + insert + out.slice(r.to), doc)

    const all = fakeView(state)
    liveFindTarget(all.view).replaceAll(found, 'ΩΩ')
    expect(all.last()?.newDoc.toString(), `${file} replace all "${label}"`).toBe(
      replaceWith(found, 'ΩΩ')
    )
    const undoneAll = run(undo as never, (all.last() as Transaction).state)
    expect(undoneAll.tr?.newDoc.sliceString(0), `${file} undo all`).toBe(text)

    for (const match of [found[0], found[found.length - 1]]) {
      const one = fakeView(state)
      liveFindTarget(one.view).replace(match, '')
      expect(one.last()?.newDoc.toString(), `${file} replace one "${label}"`).toBe(
        replaceWith([match], '')
      )
      const undone = run(undo as never, (one.last() as Transaction).state)
      expect(undone.tr?.newDoc.sliceString(0), `${file} undo one`).toBe(text)
    }
  }
  return { searched }
}

/**
 * The TODO helper among the real markup. At a spread of places, writing a TODO there (or over the word there) changes
 * exactly that stretch to `**TODO(EO)**: ` with the cursor after it, and one undo gives the note back; the `/todo` trigger
 * is recognised only after white space or at a line start, and only for exactly those five characters.
 */
function checkTodo(file: string, text: string): { triggers: number } {
  let triggers = 0
  const step = Math.max(1, Math.floor(text.length / 25))
  for (let pos = 0; pos <= text.length; pos += step) {
    const state = stateFor(text, pos)
    const doc = state.doc.toString()
    const word = state.wordAt(pos)
    for (const [from, to, owner] of [
      [pos, pos, 'EO'],
      ...(word ? [[word.from, word.to, null] as const] : [])
    ] as [number, number, string | null][]) {
      const here = fakeView(state)
      insertTodoText(here.view, from, to, owner)
      const tr = here.last() as Transaction
      const inserted = `**${owner ? `TODO(${owner})` : 'TODO'}**: `
      expect(tr.newDoc.toString(), `${file} todo @${from}-${to}`).toBe(
        doc.slice(0, from) + inserted + doc.slice(to)
      )
      expect(tr.newSelection.main.head, `${file} todo cursor`).toBe(from + inserted.length)
      const undone = run(undo as never, tr.state)
      expect(undone.tr?.newDoc.sliceString(0), `${file} todo undo`).toBe(text)
    }
    // `/todo` typed here.
    const typed = `${doc.slice(0, pos)}/todo${doc.slice(pos)}`
    const end = pos + 5
    const at = todoTriggerAt({ state: stateFor(typed, end) } as EditorView, end)
    if (at !== null) {
      triggers += 1
      expect(at, `${file} trigger start`).toBe(pos)
      const line = state.doc.lineAt(pos)
      const lead = doc.slice(line.from, pos)
      expect(lead === '' || /\s$/.test(lead), `${file} trigger lead "${lead}"`).toBe(true)
    }
  }
  return { triggers }
}

/**
 * The word count has no Markdown left in it: no word that is only marker characters, nothing of a link's address. (`=`, `>`, `|` and `#` are left out of the marker set: real prose has `mean = 500` and `a > b`, and one real note has
 * a heading written `## ## Title`, whose second `##` is text.)
 */
function checkWords(file: string, text: string): void {
  const words = wordsOf(text)
  expect(wordCount(text), file).toBe(words.length)
  for (const word of words) {
    expect(/^[*_~`\\]+$/.test(word), `${file}: "${word}" is only markers`).toBe(false)
    expect(word.includes(']('), `${file}: "${word}" has an address in it`).toBe(false)
  }
}

/*
 * Tables and fenced code. The real library has two tables and no fenced code, so as well as those, a table and a fence are
 * written into every note at a spread of places (between two plain paragraphs) and checked the same way. Everything here
 * reads the text itself (a regular expression per line), not the editor's own table parser, so the two can disagree.
 */
const SYN_TABLE = '| A | B |\n|:--|--:|\n| 1 | **x** \\| y |\n| | z |'
const SYN_FENCE = '```js\nconst a = 1\n\nlet b\n```'
const SYN_FENCE_HEADING = '```\n## not a heading\nx\n```'

/** Where a block can go as a paragraph of its own: a blank line between two plain paragraphs (at most `max` of them, spread out), and the end of the note. */
function blockSpots(text: string, max: number): number[] {
  const spots: number[] = []
  for (const match of text.matchAll(/\n\n(?=[A-Za-z])/g)) {
    const before = text.slice(text.lastIndexOf('\n', match.index - 1) + 1, match.index)
    if (/^[A-Za-z]/.test(before)) spots.push(match.index)
  }
  const spread =
    spots.length <= max
      ? spots
      : Array.from({ length: max }, (_, i) => spots[Math.floor((i * spots.length) / max)])
  // The end of the note is always a place for one (so a note with a single paragraph is checked too).
  return [...spread, text.length]
}

const injectAt = (text: string, at: number, block: string): string =>
  `${text.slice(0, at)}\n\n${block}${text.slice(at)}`

/** The cells of a table line, read without the editor: split at pipes not preceded by a backslash. */
function indepCells(line: string): string[] {
  let body = line.trim()
  if (body.startsWith('|')) body = body.slice(1)
  if (/(?<!\\)\|$/.test(body)) body = body.slice(0, -1)
  return body.split(/(?<!\\)\|/).map((cell) => cell.trim())
}

/** Where Tab should put the cursor in each cell of a table line (document positions), worked out from the text alone: the start of the cell's text, or after the first space of an empty cell. */
function cellCarets(line: { from: number; text: string }): number[] {
  const pipes = [...line.text.matchAll(/(?<!\\)\|/g)].map((match) => match.index as number)
  const carets: number[] = []
  pipes.forEach((pipe, i) => {
    const from = pipe + 1
    const to = i + 1 < pipes.length ? pipes[i + 1] : line.text.trimEnd().length
    if (to <= from && i + 1 === pipes.length) return
    const gap = line.text.slice(from, to)
    carets.push(
      line.from +
        (gap.trim() === '' ? Math.min(from + 1, to) : from + gap.length - gap.trimStart().length)
    )
  })
  return carets
}

const DELIMITER = /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/

/** Line numbers of the document (from 1). */
interface TableAt {
  first: number
  last: number
}

/** The tables of a document: a line that starts with a pipe, a delimiter line under it, and the lines under that that start with one. */
function tablesOf(state: EditorState): TableAt[] {
  const lines = state.doc.toString().split('\n')
  const found: TableAt[] = []
  for (let k = 0; k + 1 < lines.length; k++) {
    if (!lines[k].startsWith('|') || !lines[k + 1].startsWith('|') || !DELIMITER.test(lines[k + 1]))
      continue
    let end = k + 1
    while (end + 1 < lines.length && lines[end + 1].startsWith('|')) end += 1
    found.push({ first: k + 1, last: end + 1 })
    k = end
  }
  return found
}

/**
 * One table in a note whose text is `text`, line breaks `nl`: drawn as a grid away from the cursor and as text in it, hidden
 * text never under the cursor, Tab visits every cell once without touching the text, Tab after the last adds exactly one row,
 * and typing in a cell changes that cell and no other.
 */
function checkTable(file: string, text: string, table: TableAt, nl: string): { cells: number } {
  const probe = stateFor(text)
  const doc = probe.doc
  const from = doc.line(table.first).from
  const to = doc.line(table.last).to
  const where = `${file} table@${from}`
  // A document position in the string `text`: each earlier line break is one position but `nl.length` characters.
  const offset = (pos: number): number => pos + (doc.lineAt(pos).number - 1) * (nl.length - 1)
  const lineNumbers = Array.from(
    { length: table.last - table.first + 1 },
    (_, i) => table.first + i
  )
  const rows = lineNumbers.filter((n) => n !== table.first + 1)

  // Away from the cursor: a grid. Every pipe and the whole delimiter line hidden; one drawn cell per cell; only the cells' text left.
  const outside = from > 0 ? 0 : doc.length
  if (outside < from || outside > to) {
    const state = stateFor(text, outside)
    const seen = decorationsOf(state)
    const hidden = new Set<number>()
    for (const one of seen)
      if (one.kind === 'hidden') for (let i = one.from; i < one.to; i++) hidden.add(i)
    for (const n of lineNumbers) {
      const line = doc.line(n)
      if (n === table.first + 1) {
        for (let i = line.from; i < line.to; i++)
          expect(hidden.has(i), `${where} delimiter @${i}`).toBe(true)
        continue
      }
      for (const pipe of line.text.matchAll(/(?<!\\)\|/g))
        expect(hidden.has(line.from + (pipe.index as number)), `${where} line ${n} pipe`).toBe(true)
      expect(
        seen.filter((one) => one.from === line.from && one.kind.startsWith('live-table-row')),
        `${where} line ${n} row`
      ).toHaveLength(1)
      const drawn = seen.filter(
        (one) =>
          one.from >= line.from &&
          one.from <= line.to &&
          (one.kind.startsWith('live-cell') || one.kind === 'widget')
      )
      expect(drawn.length, `${where} line ${n} cells`).toBe(indepCells(line.text).length)
      // What is left to read is the cells' text (bold marks aside).
      const visible = [...line.text]
        .filter((_, i) => !hidden.has(line.from + i))
        .join('')
        .replace(/[\s*]/g, '')
      expect(visible, `${where} line ${n} text`).toBe(
        indepCells(line.text).join('').replace(/[\s*]/g, '')
      )
    }
  }

  // With the cursor anywhere in the table or beside it: nothing hidden under it; in the table, no pipe is hidden at all.
  const step = Math.max(1, Math.floor((to - from) / 60))
  for (let pos = Math.max(0, from - 2); pos <= Math.min(doc.length, to + 2); pos += step) {
    const state = stateFor(text, pos)
    const inside = pos >= from && pos <= to
    for (const one of decorationsOf(state)) {
      if (one.kind !== 'hidden') continue
      expect(one.from < pos && pos < one.to, `${where} cursor ${pos} inside hidden`).toBe(false)
      if (inside && one.from >= from && one.to <= to)
        expect(
          state.sliceDoc(one.from, one.to).includes('|'),
          `${where} cursor ${pos}: pipe hidden`
        ).toBe(false)
    }
  }

  // Tab: every cell once, in reading order, never the delimiter line, the text untouched; then exactly one new row.
  const cellsOf = (source: EditorState): string[][] =>
    rows.map((n) => indepCells(source.doc.line(n).text))
  const before = cellsOf(probe)
  const total = before.reduce((sum, cells) => sum + cells.length, 0)
  const headLine = doc.line(table.first)
  const expectedCarets = rows.flatMap((n) => cellCarets(doc.line(n)))
  expect(expectedCarets.length, `${where} cells`).toBe(total)
  let state = stateFor(text, expectedCarets[0])
  const carets = [state.selection.main.head]
  for (let i = 1; i < total; i++) {
    const { handled, tr } = run(tableTab(true), state)
    expect(handled, `${where} Tab ${i}`).toBe(true)
    expect(tr?.docChanged, `${where} Tab ${i} changed the text`).toBe(false)
    state = (tr as Transaction).state
    carets.push(state.selection.main.head)
  }
  expect(carets, `${where} Tab visits each cell's text start, in order`).toEqual(expectedCarets)

  const added = run(tableTab(true), state)
  expect(added.tr?.docChanged, `${where} Tab after the last cell`).toBe(true)
  const row = `|${'  |'.repeat(indepCells(headLine.text).length)}`
  const end = offset(to)
  expect(added.tr?.state.sliceDoc(), `${where} new row`).toBe(
    `${text.slice(0, end)}${nl}${row}${text.slice(end)}`
  )
  const undone = run(undo as never, (added.tr as Transaction).state)
  expect(undone.tr?.state.sliceDoc(), `${where} undo`).toBe(text)

  // Typing in each cell changes that cell and no other.
  let index = 0
  rows.forEach((_, r) => {
    before[r].forEach((_, c) => {
      const caret = expectedCarets[index++]
      const edited = probe.update({ changes: { from: caret, insert: 'Ω' } }).state
      expect(edited.sliceDoc(), `${where} typed`).toBe(
        `${text.slice(0, offset(caret))}Ω${text.slice(offset(caret))}`
      )
      cellsOf(edited).forEach((cells, i) =>
        cells.forEach((cell, j) =>
          expect(cell, `${where} cell ${i}:${j} after typing in ${r}:${c}`).toBe(
            i === r && j === c ? `Ω${before[i][j]}` : before[i][j]
          )
        )
      )
    })
  })
  return { cells: total }
}

/** A fenced block at `start`..`end` (document positions), its opening and closing lines 5 and 3 characters as in `SYN_FENCE`. */
function checkFence(file: string, text: string, start: number, end: number): void {
  const where = `${file} fence@${start}`
  const open = { from: start, to: start + 5 }
  const close = { from: end - 3, to: end }
  const hiddenOf = (state: EditorState): { from: number; to: number }[] =>
    decorationsOf(state).filter((one) => one.kind === 'hidden')
  const covers = (
    list: { from: number; to: number }[],
    range: { from: number; to: number }
  ): boolean => list.some((one) => one.from === range.from && one.to === range.to)

  const away = stateFor(text, 0)
  expect(covers(hiddenOf(away), open), `${where} opening fence hidden`).toBe(true)
  expect(covers(hiddenOf(away), close), `${where} closing fence hidden`).toBe(true)
  const kinds = decorationsOf(away).filter((one) => one.from >= start && one.from <= end)
  expect(kinds.filter((one) => one.kind === 'live-codeblock live-fence-hidden')).toHaveLength(2)
  expect(kinds.filter((one) => one.kind === 'live-codeblock')).toHaveLength(3)

  for (
    let pos = Math.max(0, start - 2);
    pos <= Math.min(stateFor(text).doc.length, end + 2);
    pos++
  ) {
    const state = stateFor(text, pos)
    const inside = pos >= start && pos <= end
    const hidden = hiddenOf(state)
    for (const one of hidden)
      expect(one.from < pos && pos < one.to, `${where} cursor ${pos} inside hidden`).toBe(false)
    expect(covers(hidden, open), `${where} cursor ${pos}: opening fence`).toBe(!inside)
    expect(covers(hidden, close), `${where} cursor ${pos}: closing fence`).toBe(!inside)
  }

  // Cmd-Option-C inside the block takes the fence lines away, and one undo puts them back.
  const { tr } = run(toggleCodeBlock, stateFor(text, start + 8))
  expect(tr?.state.sliceDoc(), `${where} unwrap`).toBe(
    `${text.slice(0, start)}const a = 1\n\nlet b${text.slice(end)}`
  )
  expect(
    run(undo as never, (tr as Transaction).state).tr?.state.sliceDoc(),
    `${where} unwrap undo`
  ).toBe(text)
}

/** Replace-all and find over a word of the written-in block, compared with an independent search. */
function checkFindIn(file: string, text: string, label: string): void {
  const state = stateFor(text)
  const doc = state.doc.toString()
  const expected = [...doc.matchAll(new RegExp(label, 'giu'))].map((m) => ({
    from: m.index,
    to: m.index + m[0].length
  }))
  const found = findInDoc(state.doc, label)
  expect(found, `${file} find "${label}"`).toEqual(expected)
  const all = fakeView(state)
  liveFindTarget(all.view).replaceAll(found, 'ΩΩ')
  expect(all.last()?.newDoc.toString(), `${file} replace all "${label}"`).toBe(
    expected.reduceRight((out, r) => `${out.slice(0, r.from)}ΩΩ${out.slice(r.to)}`, doc)
  )
  expect(run(undo as never, (all.last() as Transaction).state).tr?.newDoc.sliceString(0)).toBe(text)
}

/** The outline of a note with something written into it: the same headings, and each still found by its line. */
function checkOutline(file: string, base: string, changed: string): void {
  const texts = (markdown: string): string[] =>
    locatedOutline(markdown, [1, 2, 3, 4, 5, 6]).map((h) => h.text)
  expect(texts(changed), `${file} outline`).toEqual(texts(base))
  const state = stateFor(changed)
  for (const item of locatedOutline(changed, [1, 2, 3, 4, 5, 6]))
    expect(headingStart(state, item.line), `${file} heading "${item.text}"`).not.toBeNull()
}

function checkBlocks(file: string, text: string): { tables: number; fences: number } {
  let tables = 0
  let fences = 0
  const base = wordCount(text)

  // The tables the note has.
  for (const table of tablesOf(stateFor(text))) {
    checkTable(file, text, table, '\n')
    tables += 1
  }

  for (const at of blockSpots(text, 3)) {
    // A table written in, in a note with LF and (to see that a Windows note is no different) with CRLF.
    const withTable = injectAt(text, at, SYN_TABLE)
    expect(tablesOf(stateFor(withTable)).length, `${file} table written at ${at}`).toBeGreaterThan(
      0
    )
    for (const [note, nl] of [
      [withTable, '\n'],
      [withTable.replace(/\n/g, '\r\n'), '\r\n']
    ] as const) {
      const written = tablesOf(stateFor(note)).find(
        (table) => stateFor(note).doc.line(table.first).text === '| A | B |'
      )
      expect(written, `${file} the written table is found`).toBeDefined()
      checkTable(file, note, written as TableAt, nl)
      tables += 1
    }
    checkNote(file, withTable)
    expect(wordCount(withTable), `${file} words with a table`).toBe(base + 6)
    checkOutline(file, text, withTable)
    checkFindIn(file, withTable, 'z')
    checkFindIn(file, withTable, 'x')

    // A fence written in.
    const withFence = injectAt(text, at, SYN_FENCE)
    checkFence(file, withFence, at + 2, at + 2 + SYN_FENCE.length)
    checkNote(file, withFence)
    expect(wordCount(withFence), `${file} words with a fence`).toBe(base + 6)
    fences += 1

    // Headings inside a fence are not headings: not in the outline, not drawn as one.
    const withHeading = injectAt(text, at, SYN_FENCE_HEADING)
    checkOutline(file, text, withHeading)
    const headingState = stateFor(withHeading, 0)
    const headingLine = headingState.doc.lineAt(at + 2 + 4)
    expect(headingLine.text, file).toBe('## not a heading')
    expect(
      decorationsOf(headingState).filter(
        (one) => one.from === headingLine.from && one.kind.startsWith('live-h')
      ),
      `${file} heading drawn inside a fence`
    ).toEqual([])

    // A fence that is never closed keeps its opening line showing, and nothing is hidden under the cursor.
    const unclosed = injectAt(text, at, '```\nx')
    const state = stateFor(unclosed, 0)
    const opening = { from: at + 2, to: at + 5 }
    expect(
      decorationsOf(state).some(
        (one) => one.kind === 'hidden' && one.from < opening.to && one.to > opening.from
      ),
      `${file} unclosed fence hidden`
    ).toBe(false)
    checkNote(file, unclosed)
  }
  return { tables, fences }
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

  it('finds words as an independent search does, and replace (all or one) changes exactly the matches, undone in one step', () => {
    let searched = 0
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      searched += checkFind(file, splitNote(whole).body).searched
    }
    expect(searched).toBeGreaterThan(files.length)
  }, 1_200_000)

  it('writes a TODO exactly over the range it is given, undone in one step, and opens the menu only where /todo belongs', () => {
    let triggers = 0
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      triggers += checkTodo(file, splitNote(whole).body).triggers
    }
    expect(triggers).toBeGreaterThan(files.length)
  }, 1_200_000)

  it('draws tables as a grid away from the cursor and as text in it, Tab visits each cell and adds one row, and typing changes one cell', () => {
    let tables = 0
    let fences = 0
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      const found = checkBlocks(file, splitNote(whole).body)
      tables += found.tables
      fences += found.fences
    }
    // A check that finds nothing to check proves nothing.
    expect(tables).toBeGreaterThan(files.length)
    expect(fences).toBeGreaterThan(files.length)
  }, 3_600_000)

  it('counts words without counting Markdown', () => {
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      for (const text of [splitNote(whole).body, whole]) checkWords(file, text)
    }
  }, 600_000)

  it('pastes a web address over a word as a link and changes nothing else', () => {
    for (const file of files) {
      const whole = readFileSync(file, 'utf8')
      checkPaste(file, splitNote(whole).body)
    }
  }, 600_000)
})
