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
