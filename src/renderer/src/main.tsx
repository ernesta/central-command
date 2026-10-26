import './theme/fonts'
import './theme/tokens.css'
import './theme/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { moduleEntityProviders } from '@modules/index'
import App from './App'
import { registerEntityProviders } from './entities/registry'
import { autoDirectionOnFocus } from './lib/auto-direction'

// What a note can mention with `@` comes from the modules; the editor only knows the registry.
registerEntityProviders(moduleEntityProviders())

// The page's language is the Mac's (spell-check, hyphenation, screen readers); index.html only holds the fallback.
document.documentElement.lang = navigator.language

autoDirectionOnFocus()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
