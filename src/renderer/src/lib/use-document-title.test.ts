import { describe, expect, it } from 'vitest'
import { windowTitle } from './use-document-title'

describe('windowTitle', () => {
  it('puts the page before the app name', () => {
    expect(windowTitle('Methods')).toBe('Methods · Central Command')
  })

  it('is just the app name without a title', () => {
    expect(windowTitle('')).toBe('Central Command')
    expect(windowTitle('   ')).toBe('Central Command')
    expect(windowTitle(null)).toBe('Central Command')
    expect(windowTitle(undefined)).toBe('Central Command')
  })
})
