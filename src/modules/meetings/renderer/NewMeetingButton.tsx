import { useNavigate } from 'react-router'
import { CreateButton } from '@renderer/components/CreateButton'
import { meetingRoute, todayIso, useMeetingsWorkspace } from './meetings-paths'

/**
 * "New meeting": creates a meeting with only today's date at once and opens its page, where the series, times and
 * everything else are filled in at leisure.
 */
export function NewMeetingButton(): React.JSX.Element {
  const workspace = useMeetingsWorkspace()
  const navigate = useNavigate()

  return (
    <CreateButton
      create={async () => {
        const file = await window.api.meetings.create({
          workspace,
          date: todayIso(),
          task: 'auto'
        })
        void navigate(meetingRoute(workspace, file.ref.id))
      }}
    >
      New meeting
    </CreateButton>
  )
}
