import { readFile, rename } from 'fs/promises'
import { TERMINALS, WORKSPACES, type Settings } from '@shared/settings'
import { writeFileAtomic } from './atomic-write'

/**
 * Merge untrusted parsed JSON over the defaults, keeping only well-typed
 * values so a hand-edited file can never crash the app.
 */
export function normaliseSettings(raw: unknown, defaults: Settings): Settings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ui = obj.ui && typeof obj.ui === 'object' ? (obj.ui as Record<string, unknown>) : {}
  const workspace = WORKSPACES.find((w) => w === ui.workspace) ?? defaults.ui.workspace
  const moduleState =
    ui.moduleState && typeof ui.moduleState === 'object' && !Array.isArray(ui.moduleState)
      ? (ui.moduleState as Record<string, unknown>)
      : defaults.ui.moduleState
  return {
    zoteroExportPath:
      typeof obj.zoteroExportPath === 'string' && obj.zoteroExportPath.trim()
        ? obj.zoteroExportPath
        : defaults.zoteroExportPath,
    repoPath: typeof obj.repoPath === 'string' ? obj.repoPath : defaults.repoPath,
    terminal: TERMINALS.find((t) => t.id === obj.terminal)?.id ?? defaults.terminal,
    trainingAimHours:
      typeof obj.trainingAimHours === 'number' &&
      Number.isFinite(obj.trainingAimHours) &&
      obj.trainingAimHours > 0 &&
      obj.trainingAimHours <= 5000
        ? obj.trainingAimHours
        : defaults.trainingAimHours,
    trainingsFolder:
      typeof obj.trainingsFolder === 'string' ? obj.trainingsFolder : defaults.trainingsFolder,
    ui: { workspace, moduleState }
  }
}

export class SettingsStore {
  private current: Settings
  private readonly listeners = new Set<(settings: Settings, previous: Settings) => void>()

  constructor(
    private readonly file: string,
    private readonly defaults: Settings
  ) {
    this.current = defaults
  }

  get(): Settings {
    return this.current
  }

  /** Called after every successful update with the new and previous settings. */
  onChange(listener: (settings: Settings, previous: Settings) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
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
    const previous = this.current
    this.current = normaliseSettings(
      { ...this.current, ...patch, ui: { ...this.current.ui, ...patch.ui } },
      this.defaults
    )
    await writeFileAtomic(this.file, JSON.stringify(this.current, null, 2) + '\n')
    for (const listener of this.listeners) listener(this.current, previous)
    return this.current
  }
}
