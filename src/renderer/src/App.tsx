import { MemoryRouter } from 'react-router'
import { Shell } from './shell/Shell'
import { SettingsProvider } from './state/SettingsProvider'

function App(): React.JSX.Element {
  return (
    <SettingsProvider>
      {/* Electron has no address bar, so an in-memory history is enough (and supports back/forward). */}
      <MemoryRouter>
        <Shell />
      </MemoryRouter>
    </SettingsProvider>
  )
}

export default App
