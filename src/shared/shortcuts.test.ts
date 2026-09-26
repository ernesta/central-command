import { describe, expect, it } from 'vitest'
import { WORKSPACES } from './settings'
import {
  GENERAL_SHORTCUTS,
  SETTINGS_SHORTCUT,
  WORKSPACE_SHORTCUTS,
  formatChord,
  matchesShortcut,
  parseChord
} from './shortcuts'

const press = (
  key: string,
  mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}
): Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'> => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods
})

describe('parseChord', () => {
  it('reads modifiers and the key', () => {
    expect(parseChord('Mod-Shift-t')).toEqual({ mod: true, shift: true, alt: false, key: 't' })
    expect(parseChord('Mod-[')).toEqual({ mod: true, shift: false, alt: false, key: '[' })
    expect(parseChord('Tab')).toEqual({ mod: false, shift: false, alt: false, key: 'Tab' })
  })
})

describe('matchesShortcut', () => {
  it('accepts Cmd or Ctrl for Mod', () => {
    expect(matchesShortcut(press('[', { metaKey: true }), 'Mod-[')).toBe(true)
    expect(matchesShortcut(press('[', { ctrlKey: true }), 'Mod-[')).toBe(true)
  })

  it('is case-insensitive for letters (Shift makes them capitals)', () => {
    expect(matchesShortcut(press('T', { metaKey: true, shiftKey: true }), 'Mod-Shift-t')).toBe(true)
    expect(matchesShortcut(press('J', { ctrlKey: true }), 'Mod-j')).toBe(true)
  })

  it('needs exactly the chord’s modifiers, no more and no fewer', () => {
    expect(matchesShortcut(press('[', {}), 'Mod-[')).toBe(false)
    expect(matchesShortcut(press('t', { metaKey: true }), 'Mod-Shift-t')).toBe(false)
    expect(matchesShortcut(press('t', { metaKey: true, shiftKey: true }), 'Mod-t')).toBe(false)
    expect(matchesShortcut(press('j', { metaKey: true, altKey: true }), 'Mod-j')).toBe(false)
    expect(matchesShortcut(press('Tab', { metaKey: true }), 'Tab')).toBe(false)
    expect(matchesShortcut(press('Tab'), 'Tab')).toBe(true)
  })

  it('needs the right key', () => {
    expect(matchesShortcut(press(']', { metaKey: true }), 'Mod-[')).toBe(false)
  })
})

describe('formatChord', () => {
  it('uses symbols on a Mac', () => {
    expect(formatChord('Mod-Shift-t', true)).toEqual(['⇧', '⌘', 'T'])
    expect(formatChord('Mod-Alt-x', true)).toEqual(['⌥', '⌘', 'X'])
  })

  it('uses words elsewhere', () => {
    expect(formatChord('Mod-Shift-t', false)).toEqual(['Ctrl', 'Shift', 'T'])
    expect(formatChord('Mod-[', false)).toEqual(['Ctrl', '['])
  })

  it('writes the keys a Mac lacks as Fn plus an arrow, and by name elsewhere', () => {
    expect(formatChord('PageDown', true)).toEqual(['Fn', '↓'])
    expect(formatChord('PageUp', true)).toEqual(['Fn', '↑'])
    expect(formatChord('Home', true)).toEqual(['Fn', '←'])
    expect(formatChord('End', true)).toEqual(['Fn', '→'])
    expect(formatChord('PageDown', false)).toEqual(['PageDown'])
    expect(formatChord('End', false)).toEqual(['End'])
  })

  it('names keys plainly', () => {
    expect(formatChord('ArrowDown', true)).toEqual(['↓'])
    expect(formatChord('Enter', false)).toEqual(['Enter'])
    expect(formatChord('Mod-Alt-<n>', true)).toEqual(['⌥', '⌘', '1–6'])
  })
})

describe('the shortcuts that work everywhere', () => {
  it('go to the workspaces in the order of the top bar, on Cmd-1, 2 and 3', () => {
    expect(WORKSPACE_SHORTCUTS.map((s) => s.workspace)).toEqual([...WORKSPACES])
    expect(WORKSPACE_SHORTCUTS.map((s) => s.chord)).toEqual(['Mod-1', 'Mod-2', 'Mod-3'])
    expect(matchesShortcut(press('2', { metaKey: true }), 'Mod-2')).toBe(true)
  })

  it('open Settings on Cmd-comma, shown as ⌘ ,', () => {
    expect(matchesShortcut(press(',', { metaKey: true }), SETTINGS_SHORTCUT)).toBe(true)
    expect(formatChord(SETTINGS_SHORTCUT, true)).toEqual(['⌘', ','])
  })

  it('use no chord twice, so one key press never does two things', () => {
    const chords = GENERAL_SHORTCUTS.shortcuts.flatMap((s) => s.keys)
    expect(new Set(chords).size).toBe(chords.length)
  })
})
