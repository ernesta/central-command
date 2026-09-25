/**
 * Keyboard shortcuts: one place that says what a shortcut is, how a key press is matched against it and how it
 * is shown to the person. The app's own handlers match with `matchesShortcut` using the same chord strings the
 * Settings list shows, so a shortcut cannot change without its listing changing.
 *
 * A chord is written like ProseMirror's: modifiers then the key, joined by `-` (`Mod-Shift-t`, `Mod-[`, `Tab`).
 * `Mod` is Cmd on a Mac and Ctrl elsewhere. Chords with Shift or Alt should use a letter or a named key: the
 * browser reports `{` for Shift+`[` and a symbol for Alt+a digit.
 */

export interface Shortcut {
  action: string
  /** Alternatives that do the same thing, each a chord. */
  keys: string[]
  /** A short extra, such as when it applies. */
  note?: string
}

export interface ShortcutGroup {
  title: string
  shortcuts: Shortcut[]
}

/** Stands for "1 to 6" in a chord that is listed once for a range of keys (headings). */
export const RANGE_KEY = '<n>'

export interface Chord {
  mod: boolean
  shift: boolean
  alt: boolean
  key: string
}

export function parseChord(chord: string): Chord {
  const parts = chord.split('-')
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)
  return {
    mod: mods.includes('Mod'),
    shift: mods.includes('Shift'),
    alt: mods.includes('Alt'),
    key
  }
}

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>

/** True when the key press is exactly this chord: the same modifiers, no extra ones, and the same key. */
export function matchesShortcut(event: KeyEventLike, chord: string): boolean {
  const c = parseChord(chord)
  return (
    (event.metaKey || event.ctrlKey) === c.mod &&
    event.shiftKey === c.shift &&
    event.altKey === c.alt &&
    event.key.toLowerCase() === c.key.toLowerCase()
  )
}

const ARROWS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
}

function keyLabel(key: string): string {
  if (key === RANGE_KEY) return '1–6'
  if (key in ARROWS) return ARROWS[key]
  return key.length === 1 ? key.toUpperCase() : key
}

/** The parts of a chord as they are shown, one per key cap: `['⌘', '⇧', 'T']` on a Mac, `['Ctrl', 'Shift', 'T']` elsewhere. */
export function formatChord(chord: string, mac: boolean): string[] {
  const c = parseChord(chord)
  const parts: string[] = []
  if (mac) {
    if (c.alt) parts.push('⌥')
    if (c.shift) parts.push('⇧')
    if (c.mod) parts.push('⌘')
  } else {
    if (c.mod) parts.push('Ctrl')
    if (c.alt) parts.push('Alt')
    if (c.shift) parts.push('Shift')
  }
  parts.push(keyLabel(c.key))
  return parts
}

/** The shortcuts of the app shell, shown first in the Settings list. */
export const BACK_SHORTCUT = 'Mod-['
export const ASK_SHORTCUT = 'Mod-j'

export const GENERAL_SHORTCUTS: ShortcutGroup = {
  title: 'Everywhere',
  shortcuts: [
    {
      action: 'Go back',
      keys: [BACK_SHORTCUT],
      note: 'The mouse’s back button does the same. In a list, the editor takes it to move the item out a level.'
    },
    { action: 'Open or close Ask', keys: [ASK_SHORTCUT] },
    { action: 'Close the Ask panel, a menu or a pop-up', keys: ['Escape'] }
  ]
}
