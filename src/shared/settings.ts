export type Workspace = 'life' | 'research' | 'consulting'

export interface Settings {
  /** Path to the Better BibTeX auto-export file. */
  zoteroExportPath: string
  /** Repo the Build button opens a Claude Code session in. Empty until configured. */
  repoPath: string
  /** Remembered UI state. */
  ui: {
    workspace: Workspace
  }
}

export const WORKSPACES: readonly Workspace[] = ['life', 'research', 'consulting']

export function defaultSettings(defaultZoteroExportPath: string): Settings {
  return {
    zoteroExportPath: defaultZoteroExportPath,
    repoPath: '',
    ui: { workspace: 'research' }
  }
}
