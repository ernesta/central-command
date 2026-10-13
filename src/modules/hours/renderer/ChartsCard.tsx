import { Segmented } from '@renderer/components/Segmented'
import { useModuleState } from '@renderer/state/use-module-state'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { TypicalWeek } from './TypicalWeek'
import { WeeksChart } from './WeeksChart'
import { YearHeatMap } from './YearHeatMap'
import styles from './ChartsCard.module.css'

const VIEWS = [
  { value: 'year', label: 'Year' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'typical', label: 'Typical week' }
] as const
type View = (typeof VIEWS)[number]['value']

/**
 * Charts: the year as a heat map, its weeks as columns, or the typical week, one at a time. The body has a fixed height, so
 * switching views never moves the page.
 */
export function ChartsCard({
  workspace,
  data,
  now
}: {
  workspace: string
  data: TrackingYear
  now: Moment
}): React.JSX.Element {
  const { value, update } = useModuleState('hours-charts', (raw) => ({
    view: (VIEWS.some((v) => v.value === (raw as { view?: string } | null)?.view)
      ? (raw as { view: View }).view
      : 'year') as View
  }))
  return (
    <section className={styles.card} aria-label="Charts">
      <header className={styles.head}>
        <h2 className={styles.title}>Charts</h2>
        <Segmented
          label="Chart"
          value={value.view}
          options={VIEWS}
          onChange={(view) => update({ view })}
        />
      </header>
      <div className={styles.body}>
        {value.view === 'year' && <YearHeatMap workspace={workspace} data={data} now={now} />}
        {value.view === 'weeks' && <WeeksChart data={data} now={now} />}
        {value.view === 'typical' && <TypicalWeek data={data} now={now} />}
      </div>
    </section>
  )
}
