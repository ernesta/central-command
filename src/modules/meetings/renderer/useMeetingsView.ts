import { useModuleState } from '@renderer/state/use-module-state'
import type { MeetingWorkspace } from '../shared/types'
import { normaliseMeetingsQuery, type MeetingsQuery } from '../shared/query'

/**
 * The meeting list's search and filters, remembered between visits and launches, kept separately per
 * workspace (Research keeps its existing key, so nothing already saved is lost).
 */
export function useMeetingsView(
  workspace: MeetingWorkspace,
  initial?: Partial<MeetingsQuery>
): {
  query: MeetingsQuery
  setQuery: (patch: Partial<MeetingsQuery>) => void
} {
  const key = workspace === 'research' ? 'meetings' : `meetings-${workspace}`
  const { value, update } = useModuleState(key, normaliseMeetingsQuery, initial)
  return { query: value, setQuery: update }
}
