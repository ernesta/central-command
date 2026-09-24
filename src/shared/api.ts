import type { Settings } from './settings'

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
}

/** Channel names, kept in one place so preload and main cannot drift apart. */
export const IPC = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update'
} as const
