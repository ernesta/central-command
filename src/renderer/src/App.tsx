import { useState } from 'react'
import type { Workspace } from '@shared/settings'
import { TopBar } from './shell/TopBar'

function App(): React.JSX.Element {
  const [workspace, setWorkspace] = useState<Workspace>('research')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        onBuild={() => undefined}
        onOpenSettings={() => undefined}
      />
    </div>
  )
}

export default App
