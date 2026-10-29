import { useLocation } from 'react-router'
import { modulePath } from '@modules/types'
import { WATCH_WORKSPACES, type WatchSection, type WatchWorkspace } from '../shared/types'

export function watchBase(workspace: WatchWorkspace = 'research'): string {
  return modulePath({ workspace, id: 'watch' })
}

/** Which workspace's Watch the current page belongs to, read from the URL (`/life/…` or `/research/…`). */
export function useWatchWorkspace(): WatchWorkspace {
  const segment = useLocation().pathname.split('/')[1]
  return (WATCH_WORKSPACES as readonly string[]).includes(segment)
    ? (segment as WatchWorkspace)
    : 'research'
}

const LIST_PATH: Record<WatchSection, string> = {
  training: 'trainings',
  conference: 'conferences',
  opportunity: 'opportunities'
}

/** The list of one section's items (See all trainings, conferences, opportunities). */
export const watchListRoute = (
  section: WatchSection,
  workspace: WatchWorkspace = 'research'
): string => `${watchBase(workspace)}/${LIST_PATH[section]}`

export { todayIso } from '@shared/time'
