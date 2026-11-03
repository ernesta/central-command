import { describe, expect, it } from 'vitest'
import { showsYearFilter } from './research-year-pages'

describe('which pages show the top bar academic year filter', () => {
  it('shows on Research Home, Hours, Time off, and the Meetings, Training and Tasks landings and lists, and the Training plan', () => {
    for (const path of [
      '/research',
      '/research/hours',
      '/research/time-off',
      '/research/meetings',
      '/research/meetings/all',
      '/research/training',
      '/research/training/all',
      '/research/training/plan',
      '/research/tasks',
      '/research/tasks/all'
    ])
      expect(showsYearFilter(path), path).toBe(true)
  })

  it('stays away from pages with no year notion, a single item, and the other workspaces', () => {
    for (const path of [
      '/work',
      '/work/hours',
      '/life',
      '/life/training',
      '/settings',
      '/research/notes',
      '/research/readings',
      '/research/meetings/people',
      '/research/meetings/m/abc',
      '/research/training/t/abc',
      '/research/tasks/t/abc'
    ])
      expect(showsYearFilter(path), path).toBe(false)
  })
})
