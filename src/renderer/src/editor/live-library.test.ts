import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { splitNote } from '@shared/front-matter'
import { computeReveal } from './live-reveal'
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
})
