import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { NotePage } from './renderer/NotePage'

/** Notes: one flat folder of Markdown notes, grouped by a field on each note, with a few pinned. */
export const notesModule: LiveModuleManifest = {
  id: 'notes',
  workspace: 'research',
  label: 'Notes',
  status: 'live',
  routes: [{ path: 'n/:id', element: createElement(NotePage) }]
}
