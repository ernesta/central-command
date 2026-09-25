import type { ComponentType, ReactNode } from 'react'
import type { Workspace } from '@shared/settings'
import type { ShortcutGroup } from '@shared/shortcuts'

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
  /** Listed in Settings under Keyboard shortcuts. Add a shortcut here whenever the module gets one. */
  shortcuts?: ShortcutGroup[]
}

export type ModuleManifest = PlannedModuleManifest | LiveModuleManifest

export function modulePath(module: Pick<BaseManifest, 'workspace' | 'id'>): string {
  return `/${module.workspace}/${module.id}`
}
