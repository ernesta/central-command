import { PathField } from './PathField'
import { useSettings } from '../state/settings-context'
import styles from './SettingsPage.module.css'

export function SettingsPage(): React.JSX.Element {
  const { settings, update } = useSettings()

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>
      <div className={styles.section}>
        <PathField
          label="Zotero export path"
          help="The Better BibTeX auto-export file the Readings module syncs from. The app only reads it."
          kind="file"
          extensions={['bib']}
          value={settings.zoteroExportPath}
          onCommit={(zoteroExportPath) => void update({ zoteroExportPath })}
        />
        <PathField
          label="Project folder"
          help="The repository the Build button opens a Claude Code session in."
          kind="folder"
          placeholder="/path/to/central-command"
          value={settings.repoPath}
          onCommit={(repoPath) => void update({ repoPath })}
        />
      </div>
    </div>
  )
}
