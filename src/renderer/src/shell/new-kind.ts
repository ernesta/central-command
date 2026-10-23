import type { NavigateFunction } from 'react-router'
import { workspaceFilter, type ParsedSearch } from '@shared/search-query'
import { runQuickAction, type QuickActionId, type QuickActionWorkspace } from './quick-actions'

const ACTION: Record<NonNullable<ParsedSearch['create']>, QuickActionId> = {
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
  await runQuickAction(ACTION[parsed.create], navigate, workspaceFilter(parsed) ?? pageWorkspace)
}
