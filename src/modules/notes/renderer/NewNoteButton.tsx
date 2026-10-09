import { useNavigate } from 'react-router'
import { CreateButton } from '@renderer/components/CreateButton'
import { noteRoute, useNotesWorkspace } from './notes-paths'

/**
 * "New note": creates an untitled note at once and opens its page with the cursor in the title, where the group
 * and everything else are filled in at leisure. On a group's page the note starts in that group.
 */
export function NewNoteButton({
  group = '',
  subgroup = ''
}: {
  group?: string
  subgroup?: string
}): React.JSX.Element {
  const navigate = useNavigate()
  const workspace = useNotesWorkspace()

  return (
    <CreateButton
      create={async () => {
        const file = await window.api.notes.create({ workspace, group, subgroup })
        void navigate(noteRoute(workspace, file.ref.id), { state: { focus: 'title' } })
      }}
    >
      New note
    </CreateButton>
  )
}
