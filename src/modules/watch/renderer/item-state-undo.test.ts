import { afterEach, describe, expect, it } from 'vitest'
import { clearUndoStack, undoLast } from '@renderer/components/undo-store'
import type { WatchState } from '../shared/types'
import { setStateUndoable, undoMessage } from './item-state-undo'

afterEach(clearUndoStack)

function fake(initial: WatchState): {
  row: { id: number; title: string; state: WatchState; readAt: string | null }
  set: (id: number, state: WatchState, readAt?: string | null) => Promise<void>
} {
  const row = { id: 7, title: 'Course', state: initial, readAt: null as string | null }
  const set = async (_id: number, state: WatchState, readAt?: string | null): Promise<void> => {
    row.state = state
    row.readAt = readAt === undefined ? (state === 'seen' ? 'now' : null) : readAt
  }
  return { row, set }
}

describe('setStateUndoable', () => {
  it.each([
    ['new', 'seen'],
    ['seen', 'new'],
    ['new', 'saved'],
    ['saved', 'seen']
  ] as const)('Cmd-Z puts %s back after %s', async (before, after) => {
    const { row, set } = fake(before)
    await setStateUndoable({ ...row }, after, set)
    expect(row.state).toBe(after)
    expect(await undoLast()).toBe(true)
    expect(row.state).toBe(before)
  })

  it('records nothing when the state does not change', async () => {
    const { row, set } = fake('seen')
    await setStateUndoable({ ...row }, 'seen', set)
    expect(await undoLast()).toBe(false)
  })

  it('does not record the undo itself', async () => {
    const { row, set } = fake('new')
    await setStateUndoable({ ...row }, 'seen', set)
    await undoLast()
    expect(await undoLast()).toBe(false)
  })

  it('Cmd-Z brings back the time the item was read, and lets the page let go of the row', async () => {
    const { row, set } = fake('seen')
    row.readAt = '2026-10-20T09:00:00.000Z'
    let released = 0
    await setStateUndoable({ ...row }, 'new', set, () => released++)
    expect(row.readAt).toBeNull()
    await undoLast()
    expect(row.state).toBe('seen')
    expect(row.readAt).toBe('2026-10-20T09:00:00.000Z')
    expect(released).toBe(1)
  })

  it('says what Cmd-Z did in plain words', () => {
    expect(undoMessage('new', 'Course')).toBe('Marked “Course” as unread.')
    expect(undoMessage('seen', 'Course')).toBe('Marked “Course” as read.')
    expect(undoMessage('saved', 'Course')).toBe('Saved “Course” again.')
  })
})
