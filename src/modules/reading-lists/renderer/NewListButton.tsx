import { useNavigate } from 'react-router'
import { CreateButton } from '@renderer/components/CreateButton'
import { readingListRoute } from './reading-lists-paths'

/**
 * "New list": creates an untitled list at once and opens its page with the cursor in the title, where
 * its sections and entries are filled in at leisure.
 */
export function NewListButton(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <CreateButton
      create={async () => {
        const file = await window.api.readingLists.create({ workspace: 'research' })
        void navigate(readingListRoute(file.ref.id), { state: { isNew: true } })
      }}
    >
      New list
    </CreateButton>
  )
}
