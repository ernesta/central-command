import { useModuleState } from '@renderer/state/use-module-state'
import { normaliseViewPrefs, type ReadingsViewPrefs } from '../shared/query'

/** The Readings list state (search, filters, sort, view), remembered between visits and launches. */
export function useReadingsView(): {
  prefs: ReadingsViewPrefs
  setPrefs: (patch: Partial<ReadingsViewPrefs>) => void
} {
  const { value, update } = useModuleState('readings', normaliseViewPrefs)
  return { prefs: value, setPrefs: update }
}
