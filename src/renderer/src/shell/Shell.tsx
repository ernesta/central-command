import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { modules } from '@modules/index'
import { modulePath } from '@modules/types'
import { WORKSPACES, type Workspace } from '@shared/settings'
import { useSettings } from '../state/settings-context'
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

  // Pages outside a workspace (e.g. Settings) keep the last workspace highlighted.
  const workspace = workspaceFromPath(location.pathname) ?? settings.ui.workspace

  const switchWorkspace = (next: Workspace): void => {
    navigate(`/${next}`)
    void update({ ui: { workspace: next } })
  }

  return (
    <div className={styles.shell}>
      <TopBar
        workspace={workspace}
        onWorkspaceChange={switchWorkspace}
        onBuild={() => undefined}
        onOpenSettings={() => undefined}
      />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to={`/${settings.ui.workspace}`} replace />} />
          <Route path="/research" element={<ResearchLanding />} />
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
