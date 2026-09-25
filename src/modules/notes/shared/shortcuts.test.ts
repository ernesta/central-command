import { describe, expect, it } from 'vitest'
import { matchesShortcut } from '@shared/shortcuts'
import { NOTES_SHORTCUTS, QUICK_CAPTURE_SHORTCUT } from './shortcuts'

const press = (
  key: string,
  mods: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }
): Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'> => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods
})

describe('quick capture shortcut', () => {
  it('is Cmd or Ctrl with Shift and N, and nothing else', () => {
    expect(
      matchesShortcut(press('N', { metaKey: true, shiftKey: true }), QUICK_CAPTURE_SHORTCUT)
    ).toBe(true)
    expect(
      matchesShortcut(press('N', { ctrlKey: true, shiftKey: true }), QUICK_CAPTURE_SHORTCUT)
    ).toBe(true)
    expect(matchesShortcut(press('n', { metaKey: true }), QUICK_CAPTURE_SHORTCUT)).toBe(false)
    expect(
      matchesShortcut(
        press('N', { metaKey: true, shiftKey: true, altKey: true }),
        QUICK_CAPTURE_SHORTCUT
      )
    ).toBe(false)
  })

  it('is listed in Settings with the chord the handler matches', () => {
    expect(NOTES_SHORTCUTS.flatMap((g) => g.shortcuts.flatMap((s) => s.keys))).toContain(
      QUICK_CAPTURE_SHORTCUT
    )
  })
})
