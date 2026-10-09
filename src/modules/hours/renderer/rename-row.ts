import type { Workspace } from '@shared/settings'
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
  if (uid) await window.api.tasks.update(uid, { title })
  else await window.api.tracking.renameTask(workspace, year, date, row.label, title, row.client)
}
