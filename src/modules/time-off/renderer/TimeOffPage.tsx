import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { YearSelect } from '@renderer/components/YearSelect'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useNow } from '@renderer/state/use-now'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { useHoursWorkspace } from '../../hours/renderer/hours-paths'
import { AddTimeOff } from './AddTimeOff'
import { TimeOffList } from './TimeOffList'
import { TimeOffSummary } from './TimeOffSummary'
import styles from './TimeOffPage.module.css'

/** The Time off page: the year selector and Add in the header, the summary, then every day off of the year. */
export function TimeOffPage(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { year, years, setYear, data } = useTrackingYear(workspace)
  const now = useNow(false)
  const [adding, setAdding] = useState(false)

  return (
    <LandingPage>
      <LandingHeader
        backTo={`/${workspace}`}
        backLabel={WORKSPACE_LABELS[workspace]}
        title="Time off"
        actions={
          <div className={styles.actions}>
            <YearSelect year={year} years={years} onChange={setYear} />
            <Button
              variant="primary"
              icon={<Plus size={16} strokeWidth={1.75} aria-hidden />}
              disabled={adding}
              onClick={() => setAdding(true)}
            >
              Add
            </Button>
          </div>
        }
      />
      {data && (
        <div className={styles.stack}>
          {adding && (
            <AddTimeOff
              workspace={workspace}
              data={data}
              today={now.date}
              onDone={() => setAdding(false)}
            />
          )}
          <TimeOffSummary data={data} today={now.date} />
          <TimeOffList workspace={workspace} data={data} today={now.date} />
        </div>
      )}
    </LandingPage>
  )
}
