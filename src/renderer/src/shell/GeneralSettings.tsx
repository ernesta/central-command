import { useSettings } from '../state/settings-context'
import { PathField } from './PathField'
import { TerminalField } from './TerminalField'
import { ThemeField } from './ThemeField'
import styles from './GeneralSettings.module.css'

/** Appearance and the Build button: theme, the repository Build opens, and which terminal it uses. */
export function GeneralSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  return (
    <section className={styles.section} aria-labelledby="general-settings">
      <h2 id="general-settings" className={styles.heading}>
        General
      </h2>
      <ThemeField value={settings.theme} onChange={(theme) => void update({ theme })} />
      <PathField
        label="Central Command repository path"
        help="The Central Command code repository. The Build button opens a Claude Code session here so you can change the app itself."
        kind="folder"
        placeholder="/path/to/central-command"
        value={settings.repoPath}
        onCommit={(repoPath) => void update({ repoPath })}
      />
      <TerminalField value={settings.terminal} onChange={(terminal) => void update({ terminal })} />
    </section>
  )
}
