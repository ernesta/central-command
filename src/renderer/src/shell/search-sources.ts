import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { moduleSearches } from '@modules/index'
import { searchPeople } from '@modules/meetings/renderer/people-search'
import type { Searchable } from '@shared/search'
import { searchCommands } from './commands'
import { useQuickActionWorkspace } from './useQuickActionWorkspace'

/** The sources the search window and the results page look in: the commands, the people list, and every module's items. */
export function useSearchSources(): Searchable[] {
  const navigate = useNavigate()
  const workspace = useQuickActionWorkspace()
  // Built once per open: `navigate` does not change while the window is up.
  return useMemo<Searchable[]>(
    () => [
      {
        id: 'actions',
        label: 'Actions',
        workspace: null,
        search: (request, limit) => searchCommands(request, navigate, limit, workspace)
      },
      { id: 'people', label: 'People', workspace: null, search: searchPeople },
      ...moduleSearches()
    ],
    [navigate, workspace]
  )
}
