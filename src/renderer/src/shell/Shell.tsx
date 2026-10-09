import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { moduleGlobals, modules } from '@modules/index'
import { modulePath } from '@modules/types'
import { WORKSPACES, type Workspace } from '@shared/settings'
import {
  BACK_SHORTCUT,
  SEARCH_SHORTCUT,
  SETTINGS_SHORTCUT,
  WORKSPACE_SHORTCUTS,
  matchesShortcut
} from '@shared/shortcuts'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Notice } from '../components/Notice'
import { useSettings } from '../state/settings-context'
import { DockActions } from './DockActions'
import { usePastePlain } from './usePastePlain'
import { useEscapeFullScreen } from './useEscapeFullScreen'
import { GlobalSearch } from './GlobalSearch'
import { SearchResultsPage } from './SearchResultsPage'
import { SettingsPage } from './SettingsPage'
import { ResearchLanding } from './ResearchLanding'
import { TopBar } from './TopBar'
import { WorkLanding } from './WorkLanding'
import { WorkspaceEmpty } from './WorkspaceEmpty'
import styles from './Shell.module.css'

function workspaceFromPath(pathname: string): Workspace | null {
  const segment = pathname.split('/')[1]
  return WORKSPACES.find((w) => w === segment) ?? null
}

export function Shell(): React.JSX.Element {
  const { settings, update } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()
  const [buildError, setBuildError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  usePastePlain()
  useEscapeFullScreen()

  const openBuild = async (): Promise<void> => {
    const result = await window.api.build.openSession()
    setBuildError(result.ok ? null : result.message)
  }

  // Pages outside a workspace (e.g. Settings) keep the last workspace highlighted.
  const workspace = workspaceFromPath(location.pathname) ?? settings.ui.workspace

  // Browser-style back: Cmd/Ctrl+[ and the mouse's back button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (matchesShortcut(event, SEARCH_SHORTCUT)) {
        event.preventDefault()
        setSearchOpen((open) => !open)
        return
      }
      // The notes editor uses the same keys to move a list item out a level; when it handled the key press, stay.
      if (!event.defaultPrevented && matchesShortcut(event, BACK_SHORTCUT)) {
        event.preventDefault()
        void navigate(-1)
      }
    }
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button === 3) {
        event.preventDefault()
        void navigate(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [navigate])

  const switchWorkspace = (next: Workspace): void => {
    navigate(`/${next}`)
    void update({ ui: { workspace: next } })
  }

  // Mac conventions: Cmd-, opens Settings; Cmd-1, 2 and 3 go to a workspace.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (matchesShortcut(event, SETTINGS_SHORTCUT)) {
        event.preventDefault()
        void navigate('/settings')
        return
      }
      const target = WORKSPACE_SHORTCUTS.find((s) => matchesShortcut(event, s.chord))
      if (target) {
        event.preventDefault()
        void navigate(`/${target.workspace}`)
        void update({ ui: { workspace: target.workspace } })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, update])

  return (
    <div className={styles.shell}>
      <TopBar
        workspace={workspace}
        onWorkspaceChange={switchWorkspace}
        onBuild={() => void openBuild()}
        onOpenSettings={() => navigate('/settings')}
        onOpenSearch={() => setSearchOpen(true)}
      />
      {buildError && (
        <div className={styles.notice}>
          <Notice tone="error" onDismiss={() => setBuildError(null)}>
            {buildError}
          </Notice>
        </div>
      )}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      <DockActions />
      {moduleGlobals().map(({ id, Global }) => (
        <Global key={id} />
      ))}
      <main className={styles.main}>
        <ErrorBoundary resetKey={location.pathname}>
          <Routes>
            <Route path="/" element={<Navigate to={`/${settings.ui.workspace}`} replace />} />
            <Route path="/research" element={<ResearchLanding />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/life" element={<WorkspaceEmpty workspace="life" />} />
            <Route path="/work" element={<WorkLanding />} />
            {modules.flatMap((m) =>
              m.status === 'live'
                ? m.routes.map((r) => (
                    <Route
                      key={`${m.id}/${r.path}`}
                      path={`${modulePath(m)}${r.path ? `/${r.path}` : ''}`}
                      element={r.element}
                    />
                  ))
                : []
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}
