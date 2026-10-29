import { pushUndo } from '@renderer/components/undo-store'
import type { WatchItem, WatchState } from '../shared/types'

/** What Cmd-Z's toast says after it put `state` back. */
export const undoMessage = (state: WatchState, title: string): string =>
  state === 'new'
    ? `Marked “${title}” as unread.`
    : state === 'seen'
      ? `Marked “${title}” as read.`
      : `Saved “${title}” again.`

/**
 * Changes an item's state and lets Cmd-Z put the state it had back (a value changed in place: silent, `undo-store.ts`).
 * `set` is the one write, so the undo goes through the same path (with the `readAt` the item had); `onUndo` lets a page let go of a row it held; nothing is recorded when the state would not change.
 */
export function setStateUndoable(
  item: Pick<WatchItem, 'id' | 'title' | 'state' | 'readAt'>,
  next: WatchState,
  set: (id: number, state: WatchState, readAt?: string | null) => Promise<void>,
  onUndo?: () => void
): Promise<void> {
  const previous = item.state
  if (previous === next) return Promise.resolve()
  return set(item.id, next).then(() => {
    pushUndo({
      label: `change to “${item.title}”`,
      message: undoMessage(previous, item.title),
      undo: () => {
        onUndo?.()
        // The time it was read goes back too, so the Read list's order is as it was.
        return set(item.id, previous, item.readAt)
      }
    })
  })
}
