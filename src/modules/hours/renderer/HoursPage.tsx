import { YearSelect } from '@renderer/components/YearSelect'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { inYear } from '@shared/year'
import { useHoursWorkspace } from './hours-paths'
import { BalanceCard } from './BalanceCard'
import { ChartsCard } from './ChartsCard'
import { TodayCard } from './TodayCard'
import { useShownYear } from './useMeetingHours'
import { useWeek } from './useWeek'
import { ContractFields } from './ContractFields'
import { InvoiceCard } from './InvoiceCard'
import { WeekCard } from './WeekCard'
import styles from './HoursPage.module.css'

/** The Hours page: the year selector in the header, then Today beside the Charts card, the Week and invoice cards side by side, and the whole contract as one line. */
export function HoursPage(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { year, years, loaded, setYear, data: stored } = useTrackingYear(workspace)
  const { running } = useRunningTimer()
  const now = useNow(running !== null)
  // The year with its meetings' hours worked out from the notes (read-only, never saved).
  const data = useShownYear(workspace, stored, now.date)
  const { week, setWeek } = useWeek(stored?.start ?? year, now.date, stored?.weeks)

  return (
    <LandingPage>
      <LandingHeader
        title="Hours"
        actions={<YearSelect year={year} years={years} onChange={setYear} workspace={workspace} />}
      />
      {loaded && years.length === 0 && (
        <div className={styles.contract}>
          <ContractFields workspace={workspace} />
        </div>
      )}
      {data && (
        <div className={styles.stack}>
          <div className={styles.cards}>
            {inYear(now.date, data.start, data.weeks) && (
              <TodayCard workspace={workspace} data={data} running={running} now={now} />
            )}
            <ChartsCard workspace={workspace} data={data} now={now} />
          </div>
          <div className={styles.cards}>
            <WeekCard
              workspace={workspace}
              data={data}
              week={week}
              onWeekChange={setWeek}
              now={now}
            />
            {data.plan.weekAim && (
              <InvoiceCard data={data} week={week} onWeekChange={setWeek} now={now} />
            )}
          </div>
          <BalanceCard workspace={workspace} data={data} now={now} />
        </div>
      )}
    </LandingPage>
  )
}
