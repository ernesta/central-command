import { afterEach, describe, expect, it } from 'vitest'
import { clearUndoStack, undoLast } from '@renderer/components/undo-store'
import type { WatchState } from '../shared/types'
import { setStateUndoable } from './item-state-undo'

afterEach(clearUndoStack)

function fake(initial: WatchState): {
  row: { id: number; title: string; state: WatchState }
  set: (id: number, state: WatchState) => Promise<void>
} {
  const row = { id: 7, title: 'Course', state: initial }
  const set = async (_id: number, state: WatchState): Promise<void> => {
    row.state = state
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
})
