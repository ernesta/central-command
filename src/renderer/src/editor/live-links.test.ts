import { describe, expect, it } from 'vitest'
import { linkTargetAt, pastedLinkTarget } from './live-links'
import { stateFor } from './live-test-utils'

describe('linkTargetAt', () => {
  const doc =
    'See [the site](https://example.org/a) and https://b.example/x, then www.c.example and [m](cc://person/ab).'

  it('finds the address from the label or from the address itself', () => {
    const state = stateFor(doc)
    expect(linkTargetAt(state, doc.indexOf('the site') + 2)).toBe('https://example.org/a')
    expect(linkTargetAt(state, doc.indexOf('example.org') + 2)).toBe('https://example.org/a')
  })

  it('finds an address written out in the text, and gives www. addresses a scheme', () => {
    const state = stateFor(doc)
    expect(linkTargetAt(state, doc.indexOf('b.example') + 1)).toBe('https://b.example/x')
    expect(linkTargetAt(state, doc.indexOf('www.c') + 2)).toBe('https://www.c.example')
  })

  it('finds a mention (an address inside the app)', () => {
    expect(linkTargetAt(stateFor(doc), doc.indexOf('[m]') + 1)).toBe('cc://person/ab')
  })

  it('finds nothing in plain text', () => {
    expect(linkTargetAt(stateFor(doc), 1)).toBeNull()
  })
})

describe('pastedLinkTarget', () => {
  it.each([
    ['https://example.org/a?b=1', 'https://example.org/a?b=1'],
    ['  http://example.org  ', 'http://example.org'],
    ['www.example.org/x', 'https://www.example.org/x'],
    ['mailto:a@b.org', 'mailto:a@b.org']
  ])('takes %s as an address', (text, expected) => {
    expect(pastedLinkTarget(text)).toBe(expected)
  })

  it.each(['', 'hello', 'see https://example.org', 'https://a.org https://b.org', 'ftp://x.org'])(
    'does not take %j as an address',
    (text) => {
      expect(pastedLinkTarget(text)).toBeNull()
    }
  )
})
