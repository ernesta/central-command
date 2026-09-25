import { useModuleState } from '@renderer/state/use-module-state'
import { normaliseNotesQuery, type NotesQuery } from '../shared/query'

/** The notes list's search and group filter, remembered between visits and launches. */
export function useNotesView(initial?: Partial<NotesQuery>): {
  query: NotesQuery
  setQuery: (patch: Partial<NotesQuery>) => void
} {
  const { value, update } = useModuleState('notes', normaliseNotesQuery, initial)
  return { query: value, setQuery: update }
}
