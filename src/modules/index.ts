import type { Workspace } from '@shared/settings'
import { plannedModules } from './planned'
import type { LiveModuleManifest, ModuleManifest, PlannedModuleManifest } from './types'

/** Add a new module by appending its manifest here; the shell builds routes and landing pages from this list. */
export const modules: ModuleManifest[] = [...plannedModules]

export function liveModules(workspace: Workspace): LiveModuleManifest[] {
  return modules.filter(
    (m): m is LiveModuleManifest => m.status === 'live' && m.workspace === workspace
  )
}

export function plannedModulesFor(workspace: Workspace): PlannedModuleManifest[] {
  return modules.filter(
    (m): m is PlannedModuleManifest => m.status === 'planned' && m.workspace === workspace
  )
}
