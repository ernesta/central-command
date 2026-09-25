import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { NotesCard } from './renderer/NotesCard'
import { NotesLanding } from './renderer/NotesLanding'
import { NotePage } from './renderer/NotePage'
import { NotesPage } from './renderer/NotesPage'

/** Notes: one flat folder of Markdown notes, grouped by a field on each note, with a few pinned. */
export const notesModule: LiveModuleManifest = {
  id: 'notes',
  workspace: 'research',
  label: 'Notes',
  status: 'live',
  routes: [
    { path: '', element: createElement(NotesLanding) },
    { path: 'all', element: createElement(NotesPage) },
    { path: 'n/:id', element: createElement(NotePage) }
  ],
  landingCard: NotesCard
}
