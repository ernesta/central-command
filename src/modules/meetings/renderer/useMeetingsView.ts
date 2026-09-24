import { useModuleState } from '@renderer/state/use-module-state'
import { normaliseMeetingsQuery, type MeetingsQuery } from '../shared/query'

/** The meeting list's search and filters, remembered between visits and launches. */
export function useMeetingsView(initial?: Partial<MeetingsQuery>): {
  query: MeetingsQuery
  setQuery: (patch: Partial<MeetingsQuery>) => void
} {
  const { value, update } = useModuleState('meetings', normaliseMeetingsQuery, initial)
  return { query: value, setQuery: update }
}
