import { describe, expect, it } from 'vitest'
import { groupRoute, noteRoute, notesBase, notesListRoute, ungroupedRoute } from './notes-paths'

describe('notes routes', () => {
  it('sit under the workspace they belong to', () => {
    expect(notesBase('research')).toBe('/research/notes')
    expect(notesBase('work')).toBe('/work/notes')
    expect(notesListRoute('work')).toBe('/work/notes/all')
    expect(noteRoute('work', 'A B')).toBe('/work/notes/n/A%20B')
    expect(groupRoute('work', 'Plans', 'Q1')).toBe('/work/notes/all?group=Plans&subgroup=Q1')
    expect(ungroupedRoute('research')).toBe('/research/notes/all?ungrouped=1')
  })
})
