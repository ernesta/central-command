import type { LiveModuleManifest } from '../types'
import { SyncSummary } from './renderer/SyncSummary'

/** Readings: literature synced one-way from Zotero, with notes. Pages and the landing card arrive in later stages. */
export const readingsModule: LiveModuleManifest = {
  id: 'readings',
  workspace: 'research',
  label: 'Readings',
  status: 'live',
  routes: [],
  settingsSection: SyncSummary
}
