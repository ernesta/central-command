import { YearSelect } from '@renderer/components/YearSelect'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { inYear } from '@shared/year'
import { useHoursWorkspace } from './hours-paths'
import { BalanceCard } from './BalanceCard'
import { TodayCard } from './TodayCard'
import { useWeek } from './useWeek'
import { ContractFields } from './ContractFields'
import { InvoiceCard } from './InvoiceCard'
import { WeekCard } from './WeekCard'
import styles from './HoursPage.module.css'

/** The Hours page: the year selector in the header, then Today, the week and the balance. */
export function HoursPage(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { year, years, loaded, setYear, data } = useTrackingYear(workspace)
  const { running } = useRunningTimer()
  const now = useNow(running !== null)
  const { week, setWeek } = useWeek(data?.start ?? year, now.date, data?.weeks)

  return (
    <LandingPage>
      <LandingHeader
        backTo={`/${workspace}`}
        backLabel={WORKSPACE_LABELS[workspace]}
        title="Hours"
        actions={<YearSelect year={year} years={years} onChange={setYear} workspace={workspace} />}
      />
      {loaded && years.length === 0 && (
        <div className={styles.contract}>
          <ContractFields workspace={workspace} />
        </div>
      )}
      {data && (
        <div className={styles.cols}>
          <div className={styles.stack}>
            {inYear(now.date, data.start, data.weeks) && (
              <TodayCard workspace={workspace} data={data} running={running} now={now} />
            )}
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
          <div className={styles.stack}>
            <BalanceCard workspace={workspace} data={data} now={now} />
          </div>
        </div>
      )}
    </LandingPage>
  )
}
