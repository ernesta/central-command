import { useLocation } from 'react-router'
import { modulePath } from '@modules/types'
import { WATCH_WORKSPACES, type ShownKind, type WatchWorkspace } from '../shared/types'

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

/** The list of one kind's items (See all trainings, See all conferences). */
export const watchListRoute = (kind: ShownKind, workspace: WatchWorkspace = 'research'): string =>
  `${watchBase(workspace)}/${kind === 'training' ? 'trainings' : 'conferences'}`

export { todayIso } from '@shared/time'
