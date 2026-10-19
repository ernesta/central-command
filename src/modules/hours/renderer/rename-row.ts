import { pushUndo } from '@renderer/components/undo-store'
import type { Workspace } from '@shared/settings'
import { entryDiff } from '../shared/entry-diff'
import { taskUidOf } from '@modules/tasks/shared/tracked'

/**
 * Rename a row in Hours. A row with a task renames the task, and the main process gives every hours entry on it the
 * new title (so an entry and its task never disagree, on any day). A row with no task yet changes only that day's
 * label. Rejects with the reason when the task cannot be renamed; nothing has changed then.
 */
export async function renameRow(
  workspace: Workspace,
  year: string,
  date: string,
  row: { label: string; client?: string; task?: string },
  to: string
): Promise<void> {
  const uid = taskUidOf(row.task)
  const title = to.trim()
  if (!title) return
  if (uid) {
    await window.api.tasks.update(uid, { title })
    // Entries follow their task by its key, so the old title gives every one of them its name back.
    pushUndo({
      label: `rename of “${row.label}”`,
      undo: async () => {
        await window.api.tasks.update(uid, { title: row.label })
      }
    })
    return
  }
  const api = window.api.tracking
  const before = await api.get(workspace, year)
  await api.renameTask(workspace, year, date, row.label, title, row.client)
  // Cmd-Z gives back exactly the entries that were renamed, so a name already used that day, which merged the two rows, splits again.
  const { before: was, after: now } = entryDiff(before, await api.get(workspace, year))
  pushUndo({
    label: `rename of “${row.label}”`,
    undo: async () => {
      const back = await api.restoreEntries(workspace, year, was, now)
      if (!back.ok) throw new Error('The entries changed since.')
    }
  })
}
