import { MemoryRouter } from 'react-router'
import { AskLauncher } from './ask/AskLauncher'
import { AskProvider } from './ask/AskProvider'
import { Shell } from './shell/Shell'
import { SettingsProvider } from './state/SettingsProvider'

function App(): React.JSX.Element {
  return (
    <SettingsProvider>
      {/* Electron has no address bar, so an in-memory history is enough (and supports back/forward). */}
      <AskProvider>
        <MemoryRouter>
          <Shell />
        </MemoryRouter>
        <AskLauncher />
      </AskProvider>
    </SettingsProvider>
  )
}

export default App
