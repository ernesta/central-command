import type { Workspace } from '@shared/settings'
import { taskUidOf } from '@modules/tasks/shared/tracked'

/**
 * Rename a row in Hours: the task it belongs to gets the new title (so an hours entry and its task never disagree),
 * then that day's labels follow. A row with no task yet changes only its label. If the task cannot be renamed
 * the labels are left as they are and the error is thrown.
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
  await window.api.tracking.renameTask(workspace, year, date, row.label, title, row.client)
}
