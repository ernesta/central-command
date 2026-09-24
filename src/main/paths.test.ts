import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/unused' } }))

import { resolvePaths } from './paths'

describe('resolvePaths', () => {
  it('places everything under <home>/CentralCommand', () => {
    const p = resolvePaths('/home/someone')
    expect(p.root).toBe('/home/someone/CentralCommand')
    expect(p.database).toBe('/home/someone/CentralCommand/data/central-command.sqlite')
    expect(p.defaultBibExport).toBe('/home/someone/CentralCommand/data/zotero-export.bib')
    expect(p.readingsNotes).toBe('/home/someone/CentralCommand/notes/readings')
    expect(p.meetingsNotes).toBe('/home/someone/CentralCommand/notes/meetings')
    expect(p.people).toBe('/home/someone/CentralCommand/data/people.json')
    expect(p.settings).toBe('/home/someone/CentralCommand/settings.json')
  })
})
