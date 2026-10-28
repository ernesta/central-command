import type { ComponentType } from 'react'
import type { Workspace } from '@shared/settings'
import type { Searchable } from '@shared/search'
import type { EntityProvider } from '@renderer/entities/registry'
import type { ShortcutGroup } from '@shared/shortcuts'
import { createHoursModule } from './hours'
import { createMeetingsModule } from './meetings'
import { createNotesModule } from './notes'
import { createTasksModule } from './tasks'
import { createTimeOffModule } from './time-off'
import { plannedModules } from './planned'
import { readingListsModule } from './reading-lists'
import { readingsModule } from './readings'
import { createTrainingModule } from './training'
import { createWatchModule } from './watch'
import type { LiveModuleManifest, ModuleManifest, PlannedModuleManifest } from './types'

/** Add a new module by appending its manifest here; the shell builds routes and landing pages from this list. */
export const modules: ModuleManifest[] = [
  readingsModule,
  createMeetingsModule('research'),
  createTrainingModule('research'),
  createNotesModule('life'),
  createHoursModule('life'),
  createTasksModule('life'),
  createTrainingModule('life'),
  createWatchModule('life'),
  createNotesModule('research'),
  readingListsModule,
  createHoursModule('research'),
  createTasksModule('research'),
  createTimeOffModule('research'),
  createWatchModule('research'),
  createMeetingsModule('work'),
  createNotesModule('work'),
  createHoursModule('work'),
  createTasksModule('work'),
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

/** Work's and Life's results are headed "Work notes", "Life notes": the same module under another workspace would otherwise repeat a heading. */
function searchLabel(m: LiveModuleManifest): string {
  if (m.workspace === 'work') return `Work ${m.label.toLowerCase()}`
  if (m.workspace === 'life') return `Life ${m.label.toLowerCase()}`
  return m.label
}

/** What a note can mention, from every module, in registration order (the order of the picker's groups). */
export function moduleEntityProviders(): EntityProvider[] {
  return modules.flatMap((m) => (m.status === 'live' ? (m.entities ?? []) : []))
}

/** The modules that can be searched, in registration order. */
export function moduleSearches(): Searchable[] {
  return modules.flatMap((m) =>
    m.status === 'live' && m.search
      ? [
          {
            id: m.id,
            label: searchLabel(m),
            workspace: m.searchUnscoped ? null : m.workspace,
            search: m.search
          }
        ]
      : []
  )
}

/** Keyboard shortcut groups contributed by live modules, in registration order. */
export function moduleShortcutGroups(): ShortcutGroup[] {
  return modules.flatMap((m) => (m.status === 'live' ? (m.shortcuts ?? []) : []))
}
