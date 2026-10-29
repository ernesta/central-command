import { pushUndo } from '@renderer/components/undo-store'
import type { WatchItem, WatchState } from '../shared/types'

/**
 * Changes an item's state and lets Cmd-Z put the state it had back (a value changed in place: silent, `undo-store.ts`).
 * `set` is the one write, so the undo goes through the same path; nothing is recorded when the state would not change.
 */
export function setStateUndoable(
  item: Pick<WatchItem, 'id' | 'title' | 'state'>,
  next: WatchState,
  set: (id: number, state: WatchState) => Promise<void>
): Promise<void> {
  const previous = item.state
  if (previous === next) return Promise.resolve()
  return set(item.id, next).then(() => {
    pushUndo({
      label: `change to “${item.title}”`,
      message: `Put “${item.title}” back to ${previous === 'new' ? 'new' : previous === 'seen' ? 'read' : 'saved'}.`,
      undo: () => set(item.id, previous)
    })
  })
}
