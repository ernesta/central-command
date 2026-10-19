import { describe, expect, it } from 'vitest'
import { moduleSearches } from '.'

describe('moduleSearches workspaces', () => {
  it('scopes every source to its workspace except readings, which have none yet', () => {
    const scopes = Object.fromEntries(
      moduleSearches().map((s) => [`${s.id}/${s.label}`, s.workspace])
    )
    expect(scopes['readings/Readings']).toBeNull()
    expect(scopes['reading-lists/Reading lists']).toBe('research')
    expect(scopes['tasks/Work tasks']).toBe('work')
    expect(scopes['notes/Life notes']).toBe('life')
    expect(scopes['meetings/Meetings']).toBe('research')
  })
})
