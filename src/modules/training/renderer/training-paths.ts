import { useLocation } from 'react-router'
import { modulePath } from '@modules/types'
import { TRAINING_WORKSPACES, type TrainingWorkspace } from '../shared/types'

export function trainingBase(workspace: TrainingWorkspace = 'research'): string {
  return modulePath({ workspace, id: 'training' })
}

/** Which workspace's training the current page belongs to, read from the URL (`/life/…` or `/research/…`). */
export function useTrainingWorkspace(): TrainingWorkspace {
  const segment = useLocation().pathname.split('/')[1]
  return (TRAINING_WORKSPACES as readonly string[]).includes(segment)
    ? (segment as TrainingWorkspace)
    : 'research'
}

/** The list of all entries. */
export function trainingListRoute(workspace: TrainingWorkspace = 'research'): string {
  return `${trainingBase(workspace)}/all`
}

/** The list filtered to one series (and year), as opened from a series card on the landing page. */
export function seriesRoute(
  series: string,
  year?: string,
  workspace: TrainingWorkspace = 'research'
): string {
  const yearPart = year === undefined ? '' : `&year=${year}`
  return `${trainingListRoute(workspace)}?series=${encodeURIComponent(series)}${yearPart}`
}

/** The training plan of a year (chosen with `?year=`). Research only. */
export const trainingPlanRoute = `${trainingBase('research')}/plan`

/** The route of one entry. Ids contain spaces, so they are encoded. */
export function entryRoute(id: string, workspace: TrainingWorkspace = 'research'): string {
  return `${trainingBase(workspace)}/t/${encodeURIComponent(id)}`
}

export { todayIso } from '@shared/time'
