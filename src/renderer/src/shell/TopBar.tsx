import { ArrowLeft, Search, Settings as SettingsIcon, Terminal } from 'lucide-react'
import { BACK_SHORTCUT, SEARCH_SHORTCUT, SETTINGS_SHORTCUT } from '@shared/shortcuts'
import { WORKSPACES, type Workspace } from '@shared/settings'
import { WORKSPACE_LABELS } from './workspaces'
import { TopBarSlot } from './top-bar-slot'
import { useFullScreen } from './useFullScreen'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { Pill } from '../components/Pill'
import styles from './TopBar.module.css'

const isMac = /Mac/i.test(navigator.platform || navigator.userAgent)

interface TopBarProps {
  workspace: Workspace
  onWorkspaceChange: (workspace: Workspace) => void
  /** Back through the visitor's own history; unavailable on the first page the window showed. */
  canGoBack: boolean
  onBack: () => void
  onBuild: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
}

export function TopBar({
  workspace,
  onWorkspaceChange,
  canGoBack,
  onBack,
  onBuild,
  onOpenSettings,
  onOpenSearch
}: TopBarProps): React.JSX.Element {
  const isFullScreen = useFullScreen()
  return (
    <header
      className={[styles.bar, isMac && !isFullScreen && styles.macInset].filter(Boolean).join(' ')}
    >
      {isMac && isFullScreen && <div className={styles.topSentinel} aria-hidden />}
      <div className={styles.lead}>
        <IconButton label="Back" shortcut={BACK_SHORTCUT} disabled={!canGoBack} onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
        </IconButton>
        <nav className={styles.pills} aria-label="Workspaces">
          {WORKSPACES.map((w) => (
            <Pill key={w} active={w === workspace} onClick={() => onWorkspaceChange(w)}>
              {WORKSPACE_LABELS[w]}
            </Pill>
          ))}
        </nav>
      </div>
      <div className={styles.actions}>
        <TopBarSlot />
        <Button
          className={styles.build}
          icon={<Terminal size={14} strokeWidth={1.75} aria-hidden />}
          onClick={onBuild}
        >
          Build
        </Button>
        <IconButton label="Search" shortcut={SEARCH_SHORTCUT} onClick={onOpenSearch}>
          <Search size={18} strokeWidth={1.75} aria-hidden />
        </IconButton>
        <IconButton label="Settings" shortcut={SETTINGS_SHORTCUT} onClick={onOpenSettings}>
          <SettingsIcon size={18} strokeWidth={1.75} aria-hidden />
        </IconButton>
      </div>
    </header>
  )
}
