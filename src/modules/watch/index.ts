import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { WatchCard } from './renderer/WatchCard'
import { WatchAllPage } from './renderer/WatchAllPage'
import { WatchPage } from './renderer/WatchPage'
import { WatchSettings } from './renderer/WatchSettings'

/**
 * Watch: what the public pages and feeds the user lists (training providers, conference sites, LINGUIST List) have
 * announced, so they stop checking by hand. Research's. The sources are set in Settings → Watch.
 */
export const watchModule: LiveModuleManifest = {
  id: 'watch',
  workspace: 'research',
  label: 'Watch',
  status: 'live',
  routes: [
    { path: '', element: createElement(WatchPage) },
    { path: 'trainings', element: createElement(WatchAllPage, { kind: 'training' }) },
    { path: 'conferences', element: createElement(WatchAllPage, { kind: 'conference' }) }
  ],
  landingCard: WatchCard,
  settingsSection: WatchSettings
}
