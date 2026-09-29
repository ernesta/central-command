import type { MeetingsApi } from '../modules/meetings/shared/api'
import type { NotesApi } from '../modules/notes/shared/api'
import type { ReadingListsApi } from '../modules/reading-lists/shared/api'
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
export type DockActionId = 'new-note' | 'new-meeting' | 'new-training'

export interface AppInfo {
  name: string
  version: string
  /** The folder holding everything the app keeps (notes, settings, the index). */
  dataDir: string
}

export interface Api {
  settings: {
    get(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
  }
  dialog: {
    /** Opens a native picker. Resolves to the chosen path, or null if cancelled. */
    pickPath(options: PickPathOptions): Promise<string | null>
  }
  app: {
    /** The app's version and where its data lives, for the About section of Settings. */
    info(): Promise<AppInfo>
    /** Opens the data folder in Finder. */
    revealData(): Promise<void>
    /** A quick action chosen from the Dock menu (macOS). Returns an unsubscribe function. */
    onDockAction(listener: (action: DockActionId) => void): () => void
    /** The window entered or left full screen (macOS). Returns an unsubscribe function. */
    onFullScreenChange(listener: (isFullScreen: boolean) => void): () => void
    /** Cmd-Shift-V was pressed: the clipboard's text, to paste without formatting. Returns an unsubscribe function. */
    onPastePlain(listener: (text: string) => void): () => void
  }
  readings: ReadingsApi
  meetings: MeetingsApi
  training: TrainingApi
  notes: NotesApi
  readingLists: ReadingListsApi
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
  appInfo: 'app:info',
  appRevealData: 'app:reveal-data',
  appDockAction: 'app:dock-action',
  appFullScreenChange: 'app:full-screen-change',
  appPastePlain: 'app:paste-plain',
  appBeforeClose: 'app:before-close',
  appCloseReady: 'app:close-ready',
  buildOpenSession: 'build:open-session'
} as const
