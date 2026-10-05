import { useModuleState } from '@renderer/state/use-module-state'
import type { TaskWorkspace } from '../shared/types'

interface Defaults {
  list: string
  sublist: string
}

function normalise(raw: unknown): Defaults {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    list: typeof o.list === 'string' ? o.list : '',
    sublist: typeof o.sublist === 'string' ? o.sublist : ''
  }
}

/** The list a task was last added to, remembered per workspace (so the next one starts there). */
export function useTaskDefaults(workspace: TaskWorkspace): {
  last: Defaults
  remember: (list: string, sublist: string) => void
} {
  const { value, update } = useModuleState(`tasks-last-list-${workspace}`, normalise)
  return { last: value, remember: (list, sublist) => update({ list, sublist }) }
}
