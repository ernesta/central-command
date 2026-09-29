import { describe, expect, it } from 'vitest'
import { isPastePlainChord, type KeyInput } from './paste-plain'

const key = (over: Partial<KeyInput>): KeyInput => ({
  type: 'keyDown',
  key: 'v',
  meta: false,
  control: false,
  alt: false,
  shift: false,
  ...over
})

describe('isPastePlainChord', () => {
  it('is Cmd-Shift-V on a Mac, in either letter case', () => {
    expect(isPastePlainChord(key({ meta: true, shift: true }), 'darwin')).toBe(true)
    expect(isPastePlainChord(key({ key: 'V', meta: true, shift: true }), 'darwin')).toBe(true)
  })

  it('is Ctrl-Shift-V elsewhere', () => {
    expect(isPastePlainChord(key({ control: true, shift: true }), 'win32')).toBe(true)
    expect(isPastePlainChord(key({ meta: true, shift: true }), 'win32')).toBe(false)
  })

  it('is not an ordinary paste, another key, another modifier or a key release', () => {
    expect(isPastePlainChord(key({ meta: true }), 'darwin')).toBe(false)
    expect(isPastePlainChord(key({ key: 'c', meta: true, shift: true }), 'darwin')).toBe(false)
    expect(isPastePlainChord(key({ meta: true, shift: true, alt: true }), 'darwin')).toBe(false)
    expect(isPastePlainChord(key({ control: true, shift: true }), 'darwin')).toBe(false)
    expect(isPastePlainChord(key({ type: 'keyUp', meta: true, shift: true }), 'darwin')).toBe(false)
  })
})
