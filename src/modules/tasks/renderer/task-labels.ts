import type { TaskPriority } from '../shared/types'

export const PRIORITY_MARKS: Record<TaskPriority, string> = { high: 'P1', normal: 'P2', low: 'P3' }
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low'
}

/** The priority choosers' options: the mark the table shows, the word on hover. */
export const PRIORITY_OPTIONS = (['high', 'normal', 'low'] as const).map((p) => ({
  value: p,
  label: PRIORITY_MARKS[p],
  title: PRIORITY_LABELS[p]
}))
