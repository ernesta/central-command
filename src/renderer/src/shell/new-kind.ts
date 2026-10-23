import type { NavigateFunction } from 'react-router'
import { workspaceFilter, type CreateRequest, type ParsedSearch } from '@shared/search-query'
import { showToast } from '@renderer/components/toast-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { runQuickAction, type QuickActionId, type QuickActionWorkspace } from './quick-actions'

const ACTION: Record<CreateRequest['kind'], QuickActionId> = {
  note: 'new-note',
  task: 'new-task',
  meeting: 'new-meeting',
  training: 'new-training',
  'reading-list': 'new-reading-list'
}

/**
 * Make what a `new:<kind>` word asks for, through the same quick action its button runs. It starts in the workspace of the
 * page, or the one a `workspace:` word names.
 */
export async function runNewKind(
  parsed: ParsedSearch,
  navigate: NavigateFunction,
  pageWorkspace: QuickActionWorkspace
): Promise<void> {
  if (!parsed.create) return
  try {
    await runQuickAction(
      ACTION[parsed.create.kind],
      navigate,
      workspaceFilter(parsed) ?? pageWorkspace,
      parsed.create
    )
  } catch (error) {
    // Work's rule about lists comes back here as a refusal from the main process.
    showToast(`Couldn’t make it: ${ipcErrorMessage(error)}`)
  }
}
