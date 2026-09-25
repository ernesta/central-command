import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { ReadingDetailPage } from './renderer/ReadingDetailPage'
import { ReadingsCard } from './renderer/ReadingsCard'
import { ReadingsPage } from './renderer/ReadingsPage'
import { SyncSummary } from './renderer/SyncSummary'
import { READINGS_SHORTCUTS } from './shared/shortcuts'

/** Readings: literature synced one-way from Zotero, with notes. */
export const readingsModule: LiveModuleManifest = {
  id: 'readings',
  workspace: 'research',
  label: 'Readings',
  status: 'live',
  routes: [
    { path: '', element: createElement(ReadingsPage) },
    { path: ':citekey', element: createElement(ReadingDetailPage) }
  ],
  landingCard: ReadingsCard,
  settingsSection: SyncSummary,
  shortcuts: READINGS_SHORTCUTS
}
