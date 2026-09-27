import { describe, expect, it } from 'vitest'
import { normaliseSettingsTab } from './settings-tabs'

const ids = ['general', 'training', 'shortcuts', 'about']

describe('normaliseSettingsTab', () => {
  it('keeps a remembered tab that still exists', () => {
    expect(normaliseSettingsTab({ tab: 'shortcuts' }, ids)).toEqual({ tab: 'shortcuts' })
  })

  it('falls back to the first tab when nothing was remembered', () => {
    expect(normaliseSettingsTab(undefined, ids)).toEqual({ tab: 'general' })
    expect(normaliseSettingsTab(null, ids)).toEqual({ tab: 'general' })
    expect(normaliseSettingsTab({}, ids)).toEqual({ tab: 'general' })
  })

  it('falls back when the remembered tab no longer exists (a module was removed, or the file was hand-edited)', () => {
    expect(normaliseSettingsTab({ tab: 'readings' }, ids)).toEqual({ tab: 'general' })
    expect(normaliseSettingsTab({ tab: 42 }, ids)).toEqual({ tab: 'general' })
  })
})
