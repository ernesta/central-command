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
    expect(p.trainingNotes).toBe('/home/someone/CentralCommand/notes/training')
    expect(p.noteFiles).toBe('/home/someone/CentralCommand/notes/notes')
    expect(p.readingListFiles).toBe('/home/someone/CentralCommand/notes/reading-lists')
    expect(p.time).toBe('/home/someone/CentralCommand/time')
    expect(p.people).toBe('/home/someone/CentralCommand/data/people.json')
    expect(p.settings).toBe('/home/someone/CentralCommand/settings.json')
  })
})

describe('resolvePaths with a relative home', () => {
  it('refuses it instead of creating a library in the working directory', () => {
    expect(() => resolvePaths('undefined/home')).toThrow(/absolute/)
  })
})
