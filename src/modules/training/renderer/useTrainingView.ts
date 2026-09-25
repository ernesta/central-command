import { useModuleState } from '@renderer/state/use-module-state'
import { normaliseTrainingQuery, type TrainingQuery } from '../shared/rules'

/** The training list's search and filters, remembered between visits and launches. */
export function useTrainingView(): {
  query: TrainingQuery
  setQuery: (patch: Partial<TrainingQuery>) => void
} {
  const { value, update } = useModuleState('training', normaliseTrainingQuery)
  return { query: value, setQuery: update }
}
