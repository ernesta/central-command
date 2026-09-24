import { readFile, rename } from 'fs/promises'
import { WORKSPACES, type Settings } from '@shared/settings'
import { writeFileAtomic } from './atomic-write'

/**
 * Merge untrusted parsed JSON over the defaults, keeping only well-typed
 * values so a hand-edited file can never crash the app.
 */
export function normaliseSettings(raw: unknown, defaults: Settings): Settings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ui = obj.ui && typeof obj.ui === 'object' ? (obj.ui as Record<string, unknown>) : {}
  const workspace = WORKSPACES.find((w) => w === ui.workspace) ?? defaults.ui.workspace
  return {
    zoteroExportPath:
      typeof obj.zoteroExportPath === 'string' && obj.zoteroExportPath.trim()
        ? obj.zoteroExportPath
        : defaults.zoteroExportPath,
    repoPath: typeof obj.repoPath === 'string' ? obj.repoPath : defaults.repoPath,
    ui: { workspace }
  }
}

export class SettingsStore {
  private current: Settings

  constructor(
    private readonly file: string,
    private readonly defaults: Settings
  ) {
    this.current = defaults
  }

  get(): Settings {
    return this.current
  }

  /** Load from disk. A missing file yields defaults; a corrupt one is set aside, never overwritten. */
  async load(): Promise<Settings> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.current
      throw error
    }
    try {
      this.current = normaliseSettings(JSON.parse(text), this.defaults)
    } catch {
      await rename(this.file, `${this.file}.corrupt-${Date.now()}`)
      this.current = this.defaults
    }
    return this.current
  }

  async update(
    patch: Partial<Omit<Settings, 'ui'>> & { ui?: Partial<Settings['ui']> }
  ): Promise<Settings> {
    this.current = normaliseSettings(
      { ...this.current, ...patch, ui: { ...this.current.ui, ...patch.ui } },
      this.defaults
    )
    await writeFileAtomic(this.file, JSON.stringify(this.current, null, 2) + '\n')
    return this.current
  }
}
