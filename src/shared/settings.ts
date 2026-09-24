export type Workspace = 'life' | 'research' | 'work'

/** Terminal apps the Build button can open a Claude Code session in (macOS). */
export type TerminalId = 'terminal' | 'ghostty'

export const TERMINALS: readonly { id: TerminalId; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'ghostty', label: 'Ghostty' }
]

export interface Settings {
  /** Path to the Better BibTeX auto-export file. */
  zoteroExportPath: string
  /** Repo the Build button opens a Claude Code session in. Empty until configured. */
  repoPath: string
  /** Terminal app the Build button opens. */
  terminal: TerminalId
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
    terminal: 'terminal',
    ui: { workspace: 'research', moduleState: {} }
  }
}
