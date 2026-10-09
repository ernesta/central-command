import { describe, expect, it } from 'vitest'
import { keymap } from '@codemirror/view'
import { RANGE_KEY } from '@shared/shortcuts'
import { createLiveState } from '../editor/live-state'
import { NOTES_EDITOR_SHORTCUTS } from './notes-shortcuts'

// Headings are `Mod-Alt-1` … `Mod-Alt-6`.
const chordsOf = (chord: string): string[] =>
  chord.includes(RANGE_KEY)
    ? [1, 2, 3, 4, 5, 6].map((n) => chord.replace(RANGE_KEY, String(n)))
    : [chord]

describe('the notes editor shortcut list', () => {
  it('does not list a chord twice', () => {
    const all = NOTES_EDITOR_SHORTCUTS.shortcuts.flatMap((s) => s.keys)
    expect(new Set(all).size).toBe(all.length)
  })
})

// Every listed chord must be bound in the editor's keymaps (src/renderer/src/editor/), except the ones that are not keys
// of the keymap (a click, a paste, the main process's Cmd-Shift-V).
describe('the notes editor shortcut list, against the editor’s keymap', () => {
  // `Mod-Shift-t` is the TODO helper's own key handler: `todo-live.test.ts` presses it.
  // `@` is a typed character: `live-entities.test.ts` types it and checks the picker is told.
  const NOT_KEYMAP = new Set(['Mod-Click', 'Mod-v', 'Mod-Shift-v', '@', 'Mod-Shift-t'])
  /** `Shift-Mod-z` and `Mod-Shift-z` are one chord: modifiers in any order, the key in lower case. */
  const canon = (chord: string): string => {
    const parts = chord.split('-')
    const key = parts.pop() as string
    return [...parts.sort(), key.toLowerCase()].join('-')
  }
  const state = createLiveState({
    doc: '',
    label: 'test',
    onChange: () => undefined,
    openLink: () => undefined
  })
  const bound = new Set(
    state
      .facet(keymap)
      .flat()
      .flatMap((b) => [b.key, b.mac, b.win, b.linux])
      .filter((chord): chord is string => Boolean(chord))
      .map(canon)
  )

  it('binds every chord it lists', () => {
    for (const shortcut of NOTES_EDITOR_SHORTCUTS.shortcuts) {
      for (const chord of shortcut.keys.flatMap(chordsOf)) {
        if (NOT_KEYMAP.has(chord)) continue
        expect(bound, `${shortcut.action}: ${chord}`).toContain(canon(chord))
      }
    }
  })

  it('notices a chord that is not bound', () => {
    expect(bound).toContain(canon('Mod-Alt-8'))
    expect(bound).not.toContain(canon('Mod-Alt-9'))
  })
})
