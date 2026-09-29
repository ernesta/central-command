import type { ComponentType, ReactNode } from 'react'
import type { Workspace } from '@shared/settings'
import type { SearchHit } from '@shared/search'
import type { ShortcutGroup } from '@shared/shortcuts'
import type { EntityProvider } from '@renderer/entities/registry'

export interface ModuleRoute {
  /** Relative to the module's base path (`/<workspace>/<id>`). Empty string is the module's index. */
  path: string
  element: ReactNode
}

interface BaseManifest {
  id: string
  workspace: Workspace
  label: string
}

/** A module that is declared but not built yet; shown as a "Coming soon" card. */
export interface PlannedModuleManifest extends BaseManifest {
  status: 'planned'
}

/**
 * A working module. Renderer-side only: a module's SQL migrations and IPC
 * handlers are registered separately in `main-registry.ts`, because the main
 * process and the renderer are different bundles.
 */
export interface LiveModuleManifest extends BaseManifest {
  status: 'live'
  routes: ModuleRoute[]
  /** Shown on the workspace landing page. Receives no props; fetches its own data. */
  landingCard?: ComponentType
  /** Rendered on the Settings page, so a module can own its own settings and status. */
  settingsSection?: ComponentType
  /** Mounted once by the shell on every page, for what must work anywhere in the app (a keyboard shortcut). Renders nothing. */
  globals?: ComponentType
  /** Finds this module's items for the global search: a few of the best matches for a query, most relevant first. */
  /** `limit` is how many of the best matches to return; the module's own default (usually 6) when left out. */
  search?: (query: string, limit?: number) => Promise<SearchHit[]>
  /** What a note can mention with `@` (people, readings, meetings, notes): the kinds of entity this module owns. Give them to one instance of a module that exists per workspace. */
  entities?: EntityProvider[]
  /** Listed in Settings under Keyboard shortcuts. Add a shortcut here whenever the module gets one. */
  shortcuts?: ShortcutGroup[]
}

export type ModuleManifest = PlannedModuleManifest | LiveModuleManifest

export function modulePath(module: Pick<BaseManifest, 'workspace' | 'id'>): string {
  return `/${module.workspace}/${module.id}`
}
