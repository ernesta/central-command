import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { NOTES_SHORTCUTS } from './shared/shortcuts'
import type { NoteWorkspace } from './shared/types'
import { NotesCard } from './renderer/NotesCard'
import { NotesLanding } from './renderer/NotesLanding'
import { QuickCapture } from './renderer/QuickCapture'
import { searchNotes } from './renderer/search'
import { NotePage } from './renderer/NotePage'
import { NotesPage } from './renderer/NotesPage'

/**
 * Notes: one flat folder of Markdown notes, grouped by a field on each note, with a few pinned. Registered once
 * per workspace (`src/modules/index.ts`); each instance shows only its own workspace's notes. Quick capture and
 * the shortcut list belong to the app, not a workspace, so only the 'research' instance carries them (a second
 * copy would start two notes on one key press); quick capture starts the note in the workspace being looked at.
 */
export function createNotesModule(workspace: NoteWorkspace): LiveModuleManifest {
  return {
    id: 'notes',
    workspace,
    label: 'Notes',
    status: 'live',
    routes: [
      { path: '', element: createElement(NotesLanding) },
      { path: 'all', element: createElement(NotesPage) },
      { path: 'n/:id', element: createElement(NotePage) }
    ],
    landingCard: NotesCard,
    search: searchNotes(workspace),
    ...(workspace === 'research' ? { globals: QuickCapture, shortcuts: NOTES_SHORTCUTS } : {})
  }
}
