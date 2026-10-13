import { describe, expect, it } from 'vitest'
import { normaliseTag } from './tag'

describe('normaliseTag', () => {
  it('lower-cases and trims', () => expect(normaliseTag('  Study-1 ')).toBe('study-1'))
  it('refuses more than one word', () => expect(normaliseTag('study 1')).toBe(''))
  it('refuses empty text', () => expect(normaliseTag('  ')).toBe(''))
})
