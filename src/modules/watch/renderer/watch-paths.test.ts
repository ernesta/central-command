import { describe, expect, it } from 'vitest'
import { itemFromSearch, watchListRoute } from './watch-paths'

describe('a list that opens on an item', () => {
  it('puts the item in the route and reads it back, in either workspace', () => {
    for (const workspace of ['research', 'life'] as const) {
      const route = watchListRoute('conference', workspace, 42)
      expect(route).toContain(`/${workspace}/watch/conferences?item=42`)
      expect(itemFromSearch(route.slice(route.indexOf('?')))).toBe(42)
    }
  })

  it('has no item in the plain list route, or for an odd value', () => {
    expect(watchListRoute('event')).not.toContain('?')
    expect(itemFromSearch('')).toBeNull()
    expect(itemFromSearch('?item=abc')).toBeNull()
    expect(itemFromSearch('?item=-3')).toBeNull()
  })
})
