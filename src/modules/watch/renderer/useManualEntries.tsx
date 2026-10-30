import { useState } from 'react'
import { showToast } from '@renderer/components/toast-store'
import { pushUndoWithToast } from '@renderer/components/undo-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useToday } from '@renderer/state/use-today'
import type { WatchItem } from '../shared/types'
import { EntryDialog } from './EntryDialog'
import { useWatchWorkspace } from './watch-paths'

export interface EntryActions {
  /** Edit an entry added by hand. */
  edit: (item: WatchItem) => void
  /** Delete one, with an Undo in the toast. */
  remove: (item: WatchItem) => void
}

/** The New entry / Edit dialog and the Delete-with-Undo of entries added by hand, for a page that lists items. */
export function useManualEntries(): {
  dialog: React.ReactNode
  openNew: () => void
  actions: EntryActions
} {
  const workspace = useWatchWorkspace()
  const today = useToday()
  const [open, setOpen] = useState<{ item?: WatchItem } | null>(null)

  const remove = (item: WatchItem): void => {
    void window.api.watch.items
      .deleteManual(item.id)
      .then((gone) =>
        // The toast's Undo and Cmd-Z are one undo; the entry comes back with its id, so a task made from it still finds it.
        pushUndoWithToast(`Deleted “${gone.title}”.`, {
          label: `deletion of “${gone.title}”`,
          message: `Brought back “${gone.title}”.`,
          undo: async () => {
            await window.api.watch.items.restoreManual(gone)
          }
        })
      )
      .catch((e) => showToast(`Couldn’t delete it: ${ipcErrorMessage(e)}`))
  }

  return {
    dialog: open && (
      <EntryDialog
        key={open.item?.id ?? 'new'}
        item={open.item}
        workspace={workspace}
        today={today}
        onDone={() => setOpen(null)}
        onCancel={() => setOpen(null)}
      />
    ),
    openNew: () => setOpen({}),
    actions: { edit: (item) => setOpen({ item }), remove }
  }
}
