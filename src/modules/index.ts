import type { ComponentType } from 'react'
import type { Workspace } from '@shared/settings'
import type { SearchHit } from '@shared/search'
import type { ShortcutGroup } from '@shared/shortcuts'
import { meetingsModule } from './meetings'
import { notesModule } from './notes'
import { plannedModules } from './planned'
import { readingsModule } from './readings'
import { trainingModule } from './training'
import type { LiveModuleManifest, ModuleManifest, PlannedModuleManifest } from './types'

/** Add a new module by appending its manifest here; the shell builds routes and landing pages from this list. */
export const modules: ModuleManifest[] = [
  readingsModule,
  meetingsModule,
  trainingModule,
  notesModule,
  ...plannedModules
]

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

/** Settings sections contributed by live modules, in registration order. Each becomes its own tab, named after the module. */
export function moduleSettingsSections(): { id: string; label: string; Section: ComponentType }[] {
  return modules.flatMap((m) =>
    m.status === 'live' && m.settingsSection
      ? [{ id: m.id, label: m.label, Section: m.settingsSection }]
      : []
  )
}

/** The components modules want mounted on every page, in registration order. */
export function moduleGlobals(): { id: string; Global: ComponentType }[] {
  return modules.flatMap((m) =>
    m.status === 'live' && m.globals ? [{ id: m.id, Global: m.globals }] : []
  )
}

/** The modules that can be searched, in registration order. */
export function moduleSearches(): {
  id: string
  label: string
  search: (query: string) => Promise<SearchHit[]>
}[] {
  return modules.flatMap((m) =>
    m.status === 'live' && m.search ? [{ id: m.id, label: m.label, search: m.search }] : []
  )
}

/** Keyboard shortcut groups contributed by live modules, in registration order. */
export function moduleShortcutGroups(): ShortcutGroup[] {
  return modules.flatMap((m) => (m.status === 'live' ? (m.shortcuts ?? []) : []))
}
