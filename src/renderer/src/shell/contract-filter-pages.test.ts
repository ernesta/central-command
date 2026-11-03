import { describe, expect, it } from 'vitest'
import { showsContractFilter } from './contract-filter-pages'

describe('which pages show the top bar contract filter', () => {
  it('shows on Work Home, Hours, Time off, and the Meetings and Tasks landings and lists', () => {
    for (const path of [
      '/work',
      '/work/hours',
      '/work/time-off',
      '/work/meetings',
      '/work/meetings/all',
      '/work/tasks',
      '/work/tasks/all'
    ])
      expect(showsContractFilter(path), path).toBe(true)
  })

  it('stays away from pages that do not follow it', () => {
    for (const path of [
      '/research',
      '/research/hours',
      '/life',
      '/settings',
      '/work/training',
      '/work/meetings/m/abc',
      '/work/tasks/t/abc',
      '/work/meetings/people'
    ])
      expect(showsContractFilter(path), path).toBe(false)
  })
})
