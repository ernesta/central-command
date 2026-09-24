import type { ComponentType, ReactNode } from 'react'
import type { Workspace } from '@shared/settings'

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
  landingCard: ComponentType
}

export type ModuleManifest = PlannedModuleManifest | LiveModuleManifest

export function modulePath(module: Pick<BaseManifest, 'workspace' | 'id'>): string {
  return `/${module.workspace}/${module.id}`
}
