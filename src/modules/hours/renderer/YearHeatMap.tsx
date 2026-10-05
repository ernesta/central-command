import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useElementWidth } from '@renderer/state/use-element-width'
import { formatDay, formatHours } from '@shared/tracking/format'
import { TIME_OFF_TYPES, type Moment, type TrackingYear } from '@shared/tracking/types'
import { addDays, weekdayOf, YEAR_WEEKS } from '@shared/year'
import { heatDays, monthColumns } from '../shared/heat'
import { weekRoute } from './hours-paths'
import styles from './YearHeatMap.module.css'

const PAD = { top: 20, left: 32, right: 4, bottom: 4 }
const MAX_STEP = 22
const GAP = 3
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** Rows run from the weekday the year starts on: the first, third and fifth are named. */
const LABELLED_ROWS = [0, 2, 4]
const OFF_LABELS = Object.fromEntries(TIME_OFF_TYPES.map((t) => [t.id, t.label]))

/** The year as a grid: a column a week, a row a weekday, shaded by how much of the day's aim was done; days off are outlined. A day opens its week. */
export function YearHeatMap({
  workspace,
  data,
  now
}: {
  workspace: string
  data: TrackingYear
  now: Moment
}): React.JSX.Element {
  const navigate = useNavigate()
  const { ref, width } = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const days = heatDays(data, now)
  const months = monthColumns(data)

  const step = Math.min(MAX_STEP, Math.max((width - PAD.left - PAD.right) / YEAR_WEEKS, 4))
  const cell = step - GAP
  const height = PAD.top + 7 * step + PAD.bottom
  const cx = (i: number): number => PAD.left + Math.floor(i / 7) * step
  const cy = (i: number): number => PAD.top + (i % 7) * step
  const open = (i: number): void =>
    void navigate(weekRoute(workspace, data.start, addDays(data.start, Math.floor(i / 7) * 7)))

  const lastBegun = days.filter((d) => !d.future).length - 1
  const move = (delta: number): void => {
    const at = active === null ? Math.max(lastBegun, 0) : active + delta
    setActive(Math.max(0, Math.min(days.length - 1, at)))
  }

  const tip = active === null ? null : days[active]
  const tipLeft = active === null ? 0 : Math.min(Math.max(cx(active) + cell / 2, 90), width - 90)

  return (
    <section className={styles.card} aria-label="The year, day by day">
      <header className={styles.head}>
        <h2 className={styles.title}>Year</h2>
        <ul className={styles.legend}>
          <li>
            Less
            {[0, 1, 2, 3].map((l) => (
              <i key={l} className={styles[`level${l}`]} />
            ))}
            More
          </li>
          <li>
            <i className={`${styles.level0} ${styles.offKey}`} />
            Day off
          </li>
        </ul>
      </header>
      <div
        ref={ref}
        className={styles.plot}
        tabIndex={0}
        role="group"
        aria-label="Hours on each day of the year; arrow keys move between days, Enter opens the week"
        onKeyDown={(event) => {
          const delta: Record<string, number> = {
            ArrowLeft: -7,
            ArrowRight: 7,
            ArrowUp: -1,
            ArrowDown: 1
          }
          if (event.key in delta) {
            event.preventDefault()
            move(delta[event.key])
          } else if (event.key === 'Enter' && active !== null) open(active)
          else if (event.key === 'Escape') setActive(null)
        }}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} aria-hidden>
            {months.map((m) => (
              <text key={m.column} className={styles.axis} x={PAD.left + m.column * step} y={12}>
                {MONTHS[m.month]}
              </text>
            ))}
            {LABELLED_ROWS.map((row) => (
              <text
                key={row}
                className={styles.axis}
                x={PAD.left - 8}
                y={PAD.top + Number(row) * step + cell / 2 + 4}
                textAnchor="end"
              >
                {DAY_NAMES[(weekdayOf(data.start) - 1 + row) % 7]}
              </text>
            ))}
            {days.map((d, i) => (
              <rect
                key={d.date}
                className={[
                  styles[`level${d.level}`],
                  d.future ? styles.future : '',
                  d.off ? styles.off : '',
                  active === i ? styles.active : ''
                ].join(' ')}
                x={cx(i)}
                y={cy(i)}
                width={cell}
                height={cell}
                rx={3}
                onPointerEnter={() => setActive(i)}
                onClick={() => open(i)}
              />
            ))}
          </svg>
        )}
        {tip && active !== null && (
          <div
            className={styles.tip}
            style={{ left: tipLeft, top: Math.max(cy(active) - 6, 8) }}
            role="status"
          >
            <strong className={styles.tipValue}>{formatHours(tip.minutes)}</strong>
            <span className={styles.tipLine}>{formatDay(tip.date)}</span>
            {tip.off && <span className={styles.tipLine}>{OFF_LABELS[tip.off]}</span>}
          </div>
        )}
      </div>
    </section>
  )
}
