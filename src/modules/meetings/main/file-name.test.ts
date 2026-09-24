import { describe, expect, it } from 'vitest'
import {
  dateFromBaseName,
  idFromFileName,
  isSafeMeetingId,
  meetingBaseName,
  meetingPath
} from './file-name'

describe('meetingBaseName', () => {
  it('is the date and series', () => {
    expect(meetingBaseName('2026-09-24', 'Supervision', [])).toBe('2026-09-24 Supervision')
    expect(meetingBaseName('2026-09-24', 'Rastle Lab', [])).toBe('2026-09-24 Rastle Lab')
  })
  it('numbers a second and third meeting of the same series on one day', () => {
    const taken = ['2026-09-24 Supervision']
    expect(meetingBaseName('2026-09-24', 'Supervision', taken)).toBe('2026-09-24 Supervision 2')
    expect(
      meetingBaseName('2026-09-24', 'Supervision', [...taken, '2026-09-24 Supervision 2'])
    ).toBe('2026-09-24 Supervision 3')
  })
  it('fills a gap and ignores other series and days', () => {
    expect(
      meetingBaseName('2026-09-24', 'Other', ['2026-09-24 Supervision', '2026-09-23 Other'])
    ).toBe('2026-09-24 Other')
    expect(
      meetingBaseName('2026-09-24', 'Supervision', [
        '2026-09-24 Supervision',
        '2026-09-24 Supervision 3'
      ])
    ).toBe('2026-09-24 Supervision 2')
  })
  it('never picks a name that differs only by case', () => {
    expect(meetingBaseName('2026-09-24', 'Supervision', ['2026-09-24 SUPERVISION'])).toBe(
      '2026-09-24 Supervision 2'
    )
  })
  it('cleans an unsafe series so it cannot escape the folder', () => {
    const name = meetingBaseName('2026-09-24', '../../etc/passwd', [])
    expect(isSafeMeetingId(name)).toBe(true)
    expect(name).not.toContain('/')
    expect(meetingBaseName('2026-09-24', '   ', [])).toBe('2026-09-24 Other')
  })
})

describe('ids and paths', () => {
  it('accepts normal ids and rejects anything that could leave the folder', () => {
    expect(isSafeMeetingId('2026-09-24 Supervision')).toBe(true)
    for (const bad of ['', '.hidden', '../x', 'a/b', 'a\\b', ' x', 'x.md', 'a\u0000b', '..']) {
      expect(isSafeMeetingId(bad)).toBe(false)
    }
  })
  it('builds paths inside the folder and throws for unsafe ids', () => {
    expect(meetingPath('/n/meetings/research', '2026-09-24 Supervision')).toBe(
      '/n/meetings/research/2026-09-24 Supervision.md'
    )
    expect(() => meetingPath('/n', '../evil')).toThrow('Invalid meeting id')
  })
  it('reads ids and dates back from file names', () => {
    expect(idFromFileName('2026-09-24 Supervision.md')).toBe('2026-09-24 Supervision')
    expect(idFromFileName('.2026-09-24 Supervision.md.tmp')).toBeNull()
    expect(idFromFileName('notes.txt')).toBeNull()
    expect(dateFromBaseName('2026-09-24 Supervision 2')).toBe('2026-09-24')
    expect(dateFromBaseName('Untitled')).toBeNull()
  })
})
