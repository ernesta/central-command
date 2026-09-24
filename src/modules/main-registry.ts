import type { Database } from 'better-sqlite3'
import type { AppPaths } from '../main/paths'
import type { Migration } from '../main/db/migrate'
import type { SettingsStore } from '../main/settings'
import { readingsMainModule } from './readings/main/register'

/** What a module's main-process code may depend on. */
export interface MainContext {
  db: Database
  paths: AppPaths
  settings: SettingsStore
}

/** Main-process half of a module: its schema and its IPC handlers. */
export interface MainModule {
  id: string
  migrations: Migration[]
  register(context: MainContext): void | (() => void)
}

/** Add a module's main-side registration here (the counterpart of the renderer manifest list). */
export const mainModules: MainModule[] = [readingsMainModule]
