import { describe, expect, it } from 'vitest'
import { isSafeFileKey } from './entity-files'

describe('isSafeFileKey', () => {
  it('accepts a path inside the folder', () => {
    expect(isSafeFileKey('research/Data Sources Summary.xlsx')).toBe(true)
  })
  it('refuses anything that could leave it', () => {
    for (const key of [
      '',
      '/etc/hosts',
      '../a',
      'research/../a',
      'a//b',
      'a\\b',
      '.hidden',
      'a/.b'
    ])
      expect(isSafeFileKey(key)).toBe(false)
  })
})
