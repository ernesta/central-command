export type Workspace = 'life' | 'research' | 'work'

export interface Settings {
  /** Path to the Better BibTeX auto-export file. */
  zoteroExportPath: string
  /** Repo the Build button opens a Claude Code session in. Empty until configured. */
  repoPath: string
  /** Remembered UI state. */
  ui: {
    workspace: Workspace
    /**
     * Remembered UI state owned by each module, keyed by module id (e.g. list filters).
     * Stored as-is; a module validates its own slice when reading it.
     */
    moduleState: Record<string, unknown>
  }
}

export const WORKSPACES: readonly Workspace[] = ['life', 'research', 'work']

export function defaultSettings(defaultZoteroExportPath: string): Settings {
  return {
    zoteroExportPath: defaultZoteroExportPath,
    repoPath: '',
    ui: { workspace: 'research', moduleState: {} }
  }
}
