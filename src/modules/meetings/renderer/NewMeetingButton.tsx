import { useNavigate } from 'react-router'
import { CreateButton } from '@renderer/components/CreateButton'
import { defaultSeries } from '../shared/types'
import { meetingRoute, todayIso, useMeetingsWorkspace } from './meetings-paths'

/**
 * "New meeting": creates a meeting for today at once and opens its page, where the series, date, times and
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
          series: defaultSeries(workspace),
          date: todayIso()
        })
        void navigate(meetingRoute(workspace, file.ref.id))
      }}
    >
      New meeting
    </CreateButton>
  )
}
