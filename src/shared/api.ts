import type { MeetingsApi } from '../modules/meetings/shared/api'
import type { ReadingsApi } from '../modules/readings/shared/api'
import type { TrainingApi } from '../modules/training/shared/api'
import type { Settings } from './settings'

export interface PickPathOptions {
  kind: 'file' | 'folder'
  title?: string
  /** Start location shown in the dialog. */
  defaultPath?: string
  /** File extensions without dots, e.g. ['bib']. Ignored for folders. */
  extensions?: string[]
}

export type BuildResult = { ok: true } | { ok: false; message: string }

export type SettingsPatch = Partial<Omit<Settings, 'ui'>> & { ui?: Partial<Settings['ui']> }

/**
 * The complete surface the renderer may use to reach the main process.
 * Exposed as window.api by the preload script; every method maps to one
 * explicitly registered IPC handler. There is deliberately no generic invoke.
 */
export interface Api {
  settings: {
    get(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
  }
  dialog: {
    /** Opens a native picker. Resolves to the chosen path, or null if cancelled. */
    pickPath(options: PickPathOptions): Promise<string | null>
  }
  readings: ReadingsApi
  meetings: MeetingsApi
  training: TrainingApi
  lifecycle: {
    /**
     * Register work to finish before the window closes (e.g. saving notes). The window waits for
     * the handler, up to a few seconds, then closes. Returns an unsubscribe function.
     */
    onBeforeClose(handler: () => Promise<void> | void): () => void
  }
  build: {
    /** Opens a terminal in the configured Central Command repository path running `claude`. */
    openSession(): Promise<BuildResult>
  }
}

/** Channel names, kept in one place so preload and main cannot drift apart. */
export const IPC = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  dialogPickPath: 'dialog:pick-path',
  appBeforeClose: 'app:before-close',
  appCloseReady: 'app:close-ready',
  buildOpenSession: 'build:open-session'
} as const
