import { describe, expect, it } from 'vitest'
import { openWatchItemIds, watchLinks } from './watch-links'
import { task } from './test-utils'

describe('watchLinks', () => {
  it('ignores a task with no item', () => {
    expect(watchLinks([task()])).toEqual([])
  })

  it('gives one link per item, with the task, its title and status', () => {
    const links = watchLinks([task({ uid: 'x', title: 'Apply', watchItemId: 4, status: 'doing' })])
    expect(links).toEqual([{ itemId: 4, uid: 'x', title: 'Apply', status: 'doing' }])
  })

  it('prefers the open task, then the latest made', () => {
    const done = task({ uid: 'd', watchItemId: 4, status: 'done', createdAt: '2026-10-09' })
    const old = task({ uid: 'o', watchItemId: 4, createdAt: '2026-10-01' })
    const fresh = task({ uid: 'f', watchItemId: 4, createdAt: '2026-10-05' })
    expect(watchLinks([done, old, fresh])[0].uid).toBe('f')
    expect(watchLinks([old, done])[0].uid).toBe('o')
    expect(watchLinks([done])[0].uid).toBe('d')
  })
})

describe('openWatchItemIds', () => {
  it('holds the items with an open task, not a done one', () => {
    const ids = openWatchItemIds([
      task({ uid: 'a', watchItemId: 1 }),
      task({ uid: 'b', watchItemId: 2, status: 'done' }),
      task({ uid: 'c', watchItemId: null })
    ])
    expect([...ids]).toEqual([1])
  })
})
