import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/unused' } }))

import { resolvePaths } from './paths'

describe('resolvePaths', () => {
  it('places everything under <home>/ControlCenter', () => {
    const p = resolvePaths('/home/someone')
    expect(p.root).toBe('/home/someone/ControlCenter')
    expect(p.database).toBe('/home/someone/ControlCenter/data/control-center.sqlite')
    expect(p.defaultBibExport).toBe('/home/someone/ControlCenter/data/zotero-export.bib')
    expect(p.readingsNotes).toBe('/home/someone/ControlCenter/notes/readings')
    expect(p.settings).toBe('/home/someone/ControlCenter/settings.json')
  })
})
