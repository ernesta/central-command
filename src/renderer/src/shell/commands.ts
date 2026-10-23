import type { NavigateFunction } from 'react-router'
import { startUnnamed } from '@modules/hours/renderer/start-request'
import { peopleRoute } from '@modules/meetings/renderer/meetings-paths'
import { fold } from '@shared/text'
import type { SearchHit } from '@shared/search'
import { textMatches, type SearchRequest } from '@shared/search-query'
import { QUICK_ACTIONS, type QuickActionWorkspace } from './quick-actions'

const DEFAULT_LIMIT = 6

interface Command {
  id: string
  title: string
  detail: string
  go: (navigate: NavigateFunction, workspace: QuickActionWorkspace) => void | Promise<void>
  /** Offered only while a timer runs (true) or while none does (false); always when absent. */
  whileRunning?: boolean
}

/** Actions the search window offers alongside results, the way a command palette does. Each does what its own
 * button does elsewhere in the app; nothing here is a shortcut around a rule those buttons enforce. */
const COMMANDS: Command[] = [
  // `new-task` and `new-reading-list` are reached only by `new:task` and `new:reading-list`, not by plain words.
  ...QUICK_ACTIONS.filter((a) => a.id !== 'new-task' && a.id !== 'new-reading-list').map(
    (a): Command => (a.id === 'stop-timer' ? { ...a, whileRunning: true } : a)
  ),
  {
    id: 'start-timer',
    title: 'Start timer',
    detail: 'Starts now, then asks which task.',
    // The same Start as the top bar's: a timer at once, with the picker open for it.
    go: (_navigate, workspace) => startUnnamed(workspace),
    whileRunning: false
  },
  {
    id: 'open-settings',
    title: 'Open Settings',
    detail: '',
    go: (navigate) => navigate('/settings')
  },
  { id: 'open-people', title: 'Open People', detail: '', go: (navigate) => navigate(peopleRoute) },
  {
    id: 'show-data',
    title: 'Show your data folder',
    detail: 'Opens it in Finder.',
    go: () => window.api.app.revealData()
  }
]

export async function searchCommands(
  request: SearchRequest,
  navigate: NavigateFunction,
  limit = DEFAULT_LIMIT,
  workspace: QuickActionWorkspace = 'research'
): Promise<SearchHit[]> {
  const matching = COMMANDS.filter((c) => textMatches(fold(c.title), request))
  const running = matching.some((c) => c.whileRunning !== undefined)
    ? (await window.api.tracking.running()) !== null
    : false
  return matching
    .filter((c) => c.whileRunning === undefined || c.whileRunning === running)
    .slice(0, limit)
    .map((c) => ({
      key: c.id,
      title: c.title,
      detail: c.detail,
      run: () => c.go(navigate, workspace)
    }))
}
