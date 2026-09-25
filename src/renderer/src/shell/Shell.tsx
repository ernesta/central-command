import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { modules } from '@modules/index'
import { modulePath } from '@modules/types'
import { WORKSPACES, type Workspace } from '@shared/settings'
import { BACK_SHORTCUT, matchesShortcut } from '@shared/shortcuts'
import { Notice } from '../components/Notice'
import { useSettings } from '../state/settings-context'
import { SettingsPage } from './SettingsPage'
import { ResearchLanding } from './ResearchLanding'
import { TopBar } from './TopBar'
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

  const openBuild = async (): Promise<void> => {
    const result = await window.api.build.openSession()
    setBuildError(result.ok ? null : result.message)
  }

  // Pages outside a workspace (e.g. Settings) keep the last workspace highlighted.
  const workspace = workspaceFromPath(location.pathname) ?? settings.ui.workspace

  // Browser-style back: Cmd/Ctrl+[ and the mouse's back button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (matchesShortcut(event, BACK_SHORTCUT)) {
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

  return (
    <div className={styles.shell}>
      <TopBar
        workspace={workspace}
        onWorkspaceChange={switchWorkspace}
        onBuild={() => void openBuild()}
        onOpenSettings={() => navigate('/settings')}
      />
      {buildError && (
        <div className={styles.notice}>
          <Notice tone="error" onDismiss={() => setBuildError(null)}>
            {buildError}
          </Notice>
        </div>
      )}
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to={`/${settings.ui.workspace}`} replace />} />
          <Route path="/research" element={<ResearchLanding />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/life" element={<WorkspaceEmpty workspace="life" />} />
          <Route path="/work" element={<WorkspaceEmpty workspace="work" />} />
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
      </main>
    </div>
  )
}
