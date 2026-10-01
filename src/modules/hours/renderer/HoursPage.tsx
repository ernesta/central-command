import { YearSelect } from '@renderer/components/YearSelect'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { inYear } from '@shared/year'
import { useHoursWorkspace } from './hours-paths'
import { TodayCard } from './TodayCard'
import { useWeek } from './useWeek'
import { WeekCard } from './WeekCard'
import styles from './HoursPage.module.css'

/** The Hours page: the year selector in the header, then Today, the week and the balance. */
export function HoursPage(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { year, years, setYear, data } = useTrackingYear(workspace)
  const { running } = useRunningTimer()
  const now = useNow(running !== null)
  const { week, setWeek } = useWeek(data?.start ?? year, now.date)

  return (
    <LandingPage>
      <LandingHeader
        backTo={`/${workspace}`}
        backLabel={WORKSPACE_LABELS[workspace]}
        title="Hours"
        actions={<YearSelect year={year} years={years} onChange={setYear} />}
      />
      {data && (
        <div className={styles.cols}>
          <div className={styles.stack}>
            {inYear(now.date, data.start) && (
              <TodayCard workspace={workspace} data={data} running={running} now={now} />
            )}
            <WeekCard
              workspace={workspace}
              data={data}
              week={week}
              onWeekChange={setWeek}
              now={now}
            />
          </div>
        </div>
      )}
    </LandingPage>
  )
}
