import { useNavigate } from 'react-router'
import { CreateButton } from '@renderer/components/CreateButton'
import type { TrainingWorkspace } from '../shared/types'
import { entryRoute, todayIso } from './training-paths'

/**
 * "New training entry": creates an untitled entry for today at once and opens its page (with the title selected), where
 * everything is filled in at leisure. Research's makes its own subtask for the lecture's hours; Life has no such task.
 */
export function NewTrainingButton({
  workspace = 'research'
}: {
  workspace?: TrainingWorkspace
}): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <CreateButton
      create={async () => {
        const file = await window.api.training.create({
          workspace,
          title: 'Untitled',
          date: todayIso(),
          ...(workspace === 'research' ? { task: 'auto' as const } : {})
        })
        void navigate(entryRoute(file.ref.id, workspace), { state: { isNew: true } })
      }}
    >
      New training entry
    </CreateButton>
  )
}
