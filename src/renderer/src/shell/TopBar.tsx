import { Settings as SettingsIcon, Terminal } from 'lucide-react'
import { WORKSPACES, type Workspace } from '@shared/settings'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { Pill } from '../components/Pill'
import styles from './TopBar.module.css'

const LABELS: Record<Workspace, string> = {
  life: 'Life',
  research: 'Research',
  consulting: 'Consulting'
}

interface TopBarProps {
  workspace: Workspace
  onWorkspaceChange: (workspace: Workspace) => void
  onBuild: () => void
  onOpenSettings: () => void
}

export function TopBar({
  workspace,
  onWorkspaceChange,
  onBuild,
  onOpenSettings
}: TopBarProps): React.JSX.Element {
  return (
    <header className={styles.bar}>
      <nav className={styles.pills} aria-label="Workspaces">
        {WORKSPACES.map((w) => (
          <Pill key={w} active={w === workspace} onClick={() => onWorkspaceChange(w)}>
            {LABELS[w]}
          </Pill>
        ))}
      </nav>
      <div className={styles.actions}>
        <Button
          className={styles.build}
          icon={<Terminal size={14} strokeWidth={1.75} aria-hidden />}
          onClick={onBuild}
        >
          Build
        </Button>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <SettingsIcon size={18} strokeWidth={1.75} aria-hidden />
        </IconButton>
      </div>
    </header>
  )
}
