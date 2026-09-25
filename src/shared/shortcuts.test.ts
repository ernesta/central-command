import { describe, expect, it } from 'vitest'
import { formatChord, matchesShortcut, parseChord } from './shortcuts'

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

  it('names keys plainly', () => {
    expect(formatChord('ArrowDown', true)).toEqual(['↓'])
    expect(formatChord('Enter', false)).toEqual(['Enter'])
    expect(formatChord('Mod-Alt-<n>', true)).toEqual(['⌥', '⌘', '1–6'])
  })
})
