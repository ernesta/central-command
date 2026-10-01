import { useLocation } from 'react-router'
import { modulePath } from '@modules/types'
import { HOURS_WORKSPACES, type HoursWorkspace } from '../shared/workspaces'

export function hoursBase(workspace: HoursWorkspace): string {
  return modulePath({ workspace, id: 'hours' })
}

/** Which workspace's hours the current page belongs to, read from the URL (`/research/…`). */
export function useHoursWorkspace(): HoursWorkspace {
  const { pathname } = useLocation()
  const segment = pathname.split('/')[1]
  return (HOURS_WORKSPACES as readonly string[]).includes(segment)
    ? (segment as HoursWorkspace)
    : 'research'
}

/** The Hours page opened on a week of a year (`?year=<start>&week=<Monday>`). */
export function weekRoute(workspace: string, yearStart: string, week: string): string {
  return `${hoursBase(workspace as HoursWorkspace)}?year=${yearStart}&week=${week}`
}

export function yearRoute(workspace: HoursWorkspace, yearStart: string): string {
  return `${hoursBase(workspace)}/year?year=${yearStart}`
}
