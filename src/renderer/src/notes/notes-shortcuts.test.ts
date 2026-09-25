import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { RANGE_KEY } from '@shared/shortcuts'
import { NOTES_EDITOR_SHORTCUTS } from './notes-shortcuts'

/** The built source of a Milkdown package (tests run from the repository root). */
const milkdownSource = (pkg: string): string =>
  readFileSync(join(process.cwd(), 'node_modules/@milkdown', pkg, 'lib/index.js'), 'utf8')

// Ours, not Milkdown's: Backspace at the start of a list item (notes-list-keymap.ts).
const OURS = new Set(['Backspace'])
// Milkdown lists these chords in several keymaps (headings are `Mod-Alt-1` … `Mod-Alt-6`).
const chordsOf = (chord: string): string[] =>
  chord.includes(RANGE_KEY)
    ? [1, 2, 3, 4, 5, 6].map((n) => chord.replace(RANGE_KEY, String(n)))
    : [chord]

describe('the notes editor shortcut list', () => {
  const source = [
    milkdownSource('preset-commonmark'),
    milkdownSource('preset-gfm'),
    milkdownSource('plugin-history')
  ].join('\n')

  it('lists only keys that Milkdown really binds (or that we bind ourselves)', () => {
    for (const shortcut of NOTES_EDITOR_SHORTCUTS.shortcuts) {
      for (const chord of shortcut.keys.flatMap(chordsOf)) {
        if (OURS.has(chord)) continue
        expect(source, `${shortcut.action}: ${chord}`).toContain(`"${chord}"`)
      }
    }
  })

  it('does not list a chord twice', () => {
    const all = NOTES_EDITOR_SHORTCUTS.shortcuts.flatMap((s) => s.keys)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('the source the check reads', () => {
  it('is Milkdown’s, so a key it does not bind is noticed', () => {
    const source = milkdownSource('preset-commonmark')
    expect(source).toContain('"Mod-Alt-8"')
    expect(source).not.toContain('"Mod-Alt-9"')
  })
})
