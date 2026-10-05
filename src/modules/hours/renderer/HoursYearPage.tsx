import { YearSelect } from '@renderer/components/YearSelect'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { TypicalWeek } from './TypicalWeek'
import { WeeksChart } from './WeeksChart'
import { YearsTable } from './YearsTable'
import { YearHeatMap } from './YearHeatMap'
import { AllWeeks } from './AllWeeks'
import { hoursBase, useHoursWorkspace } from './hours-paths'
import styles from './HoursYearPage.module.css'

/** Charts and weeks: the year as a whole. The views are added one at a time. */
export function HoursYearPage(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { year, years, setYear, data } = useTrackingYear(workspace)
  const { running } = useRunningTimer()
  const now = useNow(running !== null)

  return (
    <LandingPage>
      <LandingHeader
        backTo={hoursBase(workspace)}
        backLabel="Hours"
        title="Charts and weeks"
        actions={<YearSelect year={year} years={years} onChange={setYear} workspace={workspace} />}
      />
      {data && (
        <div className={styles.stack}>
          <WeeksChart data={data} now={now} />
          <YearHeatMap workspace={workspace} data={data} now={now} />
          <TypicalWeek data={data} now={now} />
          <AllWeeks workspace={workspace} data={data} now={now} />
          <YearsTable
            workspace={workspace}
            years={years}
            selected={year}
            onSelect={setYear}
            now={now}
          />
        </div>
      )}
    </LandingPage>
  )
}
