import type { ComponentType } from 'react'
import type { Workspace } from '@shared/settings'
import { meetingsModule } from './meetings'
import { plannedModules } from './planned'
import { readingsModule } from './readings'
import type { LiveModuleManifest, ModuleManifest, PlannedModuleManifest } from './types'

/** Add a new module by appending its manifest here; the shell builds routes and landing pages from this list. */
export const modules: ModuleManifest[] = [readingsModule, meetingsModule, ...plannedModules]

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

/** Settings sections contributed by live modules, in registration order. */
export function moduleSettingsSections(): { id: string; Section: ComponentType }[] {
  return modules.flatMap((m) =>
    m.status === 'live' && m.settingsSection ? [{ id: m.id, Section: m.settingsSection }] : []
  )
}
