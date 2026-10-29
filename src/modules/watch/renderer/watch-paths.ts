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
  event: 'events',
  opportunity: 'opportunities'
}

/** The list of one section's items (See all trainings, conferences, events, opportunities); with an `itemId` it opens on that item (`?item=`). */
export const watchListRoute = (
  section: WatchSection,
  workspace: WatchWorkspace = 'research',
  itemId?: number
): string =>
  `${watchBase(workspace)}/${LIST_PATH[section]}${itemId === undefined ? '' : `?${ITEM_PARAM}=${itemId}`}`

/** The query parameter that names the item a list opens on. */
export const ITEM_PARAM = 'item'

/** The item a list was asked to open on, from its query string (nothing for a missing or odd value). */
export function itemFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get(ITEM_PARAM)
  return value !== null && /^\d+$/.test(value) ? Number(value) : null
}

export { todayIso } from '@shared/time'
