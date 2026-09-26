import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from './urls'

describe('isSafeExternalUrl', () => {
  it('allows web addresses', () => {
    expect(isSafeExternalUrl('https://example.org/a?b=1')).toBe(true)
    expect(isSafeExternalUrl('http://example.org')).toBe(true)
  })

  it('refuses everything else', () => {
    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'ssh://host',
      'mailto:a@b.c',
      'notaurl',
      ''
    ]) {
      expect(isSafeExternalUrl(url), url).toBe(false)
    }
  })
})
