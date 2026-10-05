import type { TaskPriority } from '../shared/types'

export const PRIORITY_MARKS: Record<TaskPriority, string> = { high: 'P1', normal: 'P2', low: 'P3' }
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low'
}
