import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { searchWatch } from './renderer/search'
import { WatchCard } from './renderer/WatchCard'
import { WatchAllPage } from './renderer/WatchAllPage'
import { WatchPage } from './renderer/WatchPage'
import { WatchSettings } from './renderer/WatchSettings'
import type { WatchWorkspace } from './shared/types'

/**
 * Watch: what the public pages and feeds the user lists (training providers, conference sites, LINGUIST List) have
 * announced, so they stop checking by hand. Registered once per workspace (`src/modules/index.ts`): each has its own sources,
 * and the one sources table in Settings → Watch lists them all, with the workspace as a field.
 */
export function createWatchModule(workspace: WatchWorkspace): LiveModuleManifest {
  return {
    id: 'watch',
    workspace,
    label: 'Watch',
    status: 'live',
    routes: [
      { path: '', element: createElement(WatchPage) },
      { path: 'trainings', element: createElement(WatchAllPage, { section: 'training' }) },
      { path: 'conferences', element: createElement(WatchAllPage, { section: 'conference' }) },
      { path: 'events', element: createElement(WatchAllPage, { section: 'event' }) },
      {
        path: 'opportunities',
        element: createElement(WatchAllPage, { section: 'opportunity' })
      }
    ],
    landingCard: WatchCard,
    search: searchWatch(workspace),
    settingsSection: workspace === 'research' ? WatchSettings : undefined
  }
}
