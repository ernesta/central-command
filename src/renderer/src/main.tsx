import './theme/fonts'
import './theme/tokens.css'
import './theme/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { moduleEntityProviders } from '@modules/index'
import App from './App'
import { registerEntityProviders } from './entities/registry'

// What a note can mention with `@` comes from the modules; the editor only knows the registry.
registerEntityProviders(moduleEntityProviders())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
