import { useNavigate } from 'react-router'
import { CreateButton } from '@renderer/components/CreateButton'
import { entryRoute, todayIso } from './training-paths'

/**
 * "New training entry": creates an untitled entry for today at once and opens its page (with the title selected), where
 * everything is filled in at leisure.
 */
export function NewTrainingButton(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <CreateButton
      create={async () => {
        const file = await window.api.training.create({
          workspace: 'research',
          title: 'Untitled',
          date: todayIso(),
          task: 'auto'
        })
        void navigate(entryRoute(file.ref.id), { state: { isNew: true } })
      }}
    >
      New training entry
    </CreateButton>
  )
}
