import { describe, expect, it } from 'vitest'
import { onlyBulletsChanged, standardiseBullets } from './bullet-style'

describe('standardiseBullets', () => {
  it('turns * and + list markers into -, nested ones too', () => {
    const { text, changed } = standardiseBullets('* a\n  * b\n+ c\n- d\n')
    expect(text).toBe('- a\n  - b\n- c\n- d\n')
    expect(changed).toBe(3)
  })
  it('handles tasks and quoted lists', () => {
    expect(standardiseBullets('* [x] a\n> * b\n').text).toBe('- [x] a\n> - b\n')
  })
  it('leaves emphasis, rules, numbers and code alone', () => {
    const note =
      '*em* and **bold**\n\n* * *\n\n1. a\n\n```\n* not a list\n```\n\n    * indented code\n'
    expect(standardiseBullets(note)).toEqual({ text: note, changed: 0 })
  })
  it('is a no-op the second time', () => {
    const once = standardiseBullets('* a\n* b\n').text
    expect(standardiseBullets(once).changed).toBe(0)
  })
})

describe('onlyBulletsChanged', () => {
  it('accepts a marker change and refuses anything else', () => {
    expect(onlyBulletsChanged('* a\n', '- a\n')).toBe(true)
    expect(onlyBulletsChanged('* a\n', '- b\n')).toBe(false)
    expect(onlyBulletsChanged('a *b\n', 'a -b\n')).toBe(false)
    expect(onlyBulletsChanged('* a\n', '-- a\n')).toBe(false)
  })
})
