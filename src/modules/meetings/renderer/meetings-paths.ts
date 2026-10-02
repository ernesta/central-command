import { useLocation } from 'react-router'
import { modulePath } from '@modules/types'
import { MEETING_WORKSPACES, type MeetingWorkspace } from '../shared/types'

export function meetingsBase(workspace: MeetingWorkspace): string {
  return modulePath({ workspace, id: 'meetings' })
}

/** The list of all meetings (and the supervision log). */
export function meetingsListRoute(workspace: MeetingWorkspace): string {
  return `${meetingsBase(workspace)}/all`
}

/**
 * People are shared across every workspace, not per-workspace, so their page always lives under
 * Research's Meetings regardless of which workspace's meeting links to it.
 */
export const peopleRoute = `${meetingsBase('research')}/people`

/** One person's own page. Names contain spaces, so they are encoded. */
export function personRoute(name: string): string {
  return `${peopleRoute}/${encodeURIComponent(name)}`
}

/** The list filtered to one series, as opened from a series card on the landing page. */
export function seriesRoute(workspace: MeetingWorkspace, series: string, year?: string): string {
  const yearPart = year === undefined ? '' : `&year=${year}`
  return `${meetingsListRoute(workspace)}?series=${encodeURIComponent(series)}${yearPart}`
}

/** The route of one meeting. Ids contain spaces, so they are encoded. */
export function meetingRoute(workspace: MeetingWorkspace, id: string): string {
  return `${meetingsBase(workspace)}/m/${encodeURIComponent(id)}`
}

/** Which workspace's meetings the current page belongs to, read from the URL (`/research/…` or `/work/…`). */
export function useMeetingsWorkspace(): MeetingWorkspace {
  const { pathname } = useLocation()
  const segment = pathname.split('/')[1]
  return (MEETING_WORKSPACES as readonly string[]).includes(segment)
    ? (segment as MeetingWorkspace)
    : 'research'
}

export { todayIso } from '@shared/time'
