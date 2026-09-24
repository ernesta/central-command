import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { noteFileName, notePath } from './notes-path'

describe('noteFileName', () => {
  it('is the citekey plus .md for ordinary citekeys', () => {
    expect(noteFileName('abadieWhenShouldYou2023')).toBe('abadieWhenShouldYou2023.md')
    expect(noteFileName('smith_2020-a')).toBe('smith_2020-a.md')
  })
  it('keeps accents and other safe unicode', () => {
    expect(noteFileName('müller2015')).toBe('müller2015.md')
  })
  it('replaces characters that are unsafe in filenames', () => {
    expect(noteFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j.md')
    expect(noteFileName('tab\there\nnewline')).toBe('tab_here_newline.md')
  })
  it('cannot traverse out of the notes folder', () => {
    expect(noteFileName('../../etc/passwd')).toBe('__.._etc_passwd.md')
    expect(noteFileName('..')).toBe('_.md')
    expect(noteFileName('.hidden')).toBe('_hidden.md')
    expect(notePath('/notes', '../evil')).toBe(join('/notes', '__evil.md'))
    for (const hostile of ['../x', '..\\x', 'a/../../b', '/abs/path', 'C:\\win']) {
      expect(noteFileName(hostile)).not.toMatch(/[\\/]/)
    }
  })
  it('never produces an empty name and bounds the length', () => {
    expect(noteFileName('')).toBe('_.md')
    expect(noteFileName('   ')).toBe('_.md')
    expect(noteFileName('x'.repeat(500)).length).toBe(200 + 3)
  })
})
