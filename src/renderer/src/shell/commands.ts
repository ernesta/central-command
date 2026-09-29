import type { NavigateFunction } from 'react-router'
import { peopleRoute } from '@modules/meetings/renderer/meetings-paths'
import { fold } from '@shared/text'
import { searchTerms, type SearchHit } from '@shared/search'
import { QUICK_ACTIONS, type QuickActionWorkspace } from './quick-actions'

const DEFAULT_LIMIT = 6

interface Command {
  id: string
  title: string
  detail: string
  go: (navigate: NavigateFunction, workspace: QuickActionWorkspace) => void | Promise<void>
}

/** Actions the search window offers alongside results, the way a command palette does. Each does what its own
 * button does elsewhere in the app; nothing here is a shortcut around a rule those buttons enforce. */
const COMMANDS: Command[] = [
  ...QUICK_ACTIONS,
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
  query: string,
  navigate: NavigateFunction,
  limit = DEFAULT_LIMIT,
  workspace: QuickActionWorkspace = 'research'
): Promise<SearchHit[]> {
  const terms = searchTerms(query)
  return COMMANDS.filter((c) => terms.every((t) => fold(c.title).includes(t)))
    .slice(0, limit)
    .map((c) => ({
      key: c.id,
      title: c.title,
      detail: c.detail,
      run: () => c.go(navigate, workspace)
    }))
}
