import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useElementWidth } from '@renderer/state/use-element-width'
import { formatDay, formatHours } from '@shared/tracking/format'
import { TIME_OFF_TYPES, type Moment, type TrackingYear } from '@shared/tracking/types'
import { addDays, weekdayOf, YEAR_WEEKS } from '@shared/year'
import { heatDays, heatWindow, monthColumns } from '../shared/heat'
import { CHART_HEIGHT } from './charts-size'
import { weekRoute } from './hours-paths'
import styles from './YearHeatMap.module.css'

const PAD = { top: 20, left: 32, right: 4, bottom: 4 }
const MAX_STEP = 26
const GAP = 3
const HEIGHT = CHART_HEIGHT
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** Below this cell size a day number no longer fits. */
const MIN_LABEL_CELL = 15
const OFF_LABELS = Object.fromEntries(TIME_OFF_TYPES.map((t) => [t.id, t.label]))

/**
 * The year as a calendar grid: a column a week, a row a weekday, shaded by how much of the day's aim was done; days off are outlined.
 * A day opens its week. The cells are square and as large as the plot is tall, so as many weeks as fit across are drawn, ending with
 * the week that holds today (`heatWindow`): the grid slides with the date.
 */
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
  const totalWeeks = data.weeks ?? YEAR_WEEKS
  const lastBegun = days.filter((d) => !d.future).length - 1

  // Cells are square, as large as the plot's seven rows allow; the weeks that fit across the width are the ones shown.
  const step = Math.min(MAX_STEP, (HEIGHT - PAD.top - PAD.bottom) / 7)
  const { first, count } = heatWindow(
    totalWeeks,
    Math.floor(Math.max(lastBegun, 0) / 7),
    (width - PAD.left - PAD.right) / step
  )
  const months = monthColumns(data, first, count)
  const stepY = step
  const cell = step - GAP
  const cellH = cell
  const labelled = cell >= MIN_LABEL_CELL
  const firstDay = first * 7
  const lastDay = (first + count) * 7 - 1
  const cx = (i: number): number => PAD.left + (Math.floor(i / 7) - first) * step
  const cy = (i: number): number => PAD.top + (i % 7) * stepY
  const open = (i: number): void =>
    void navigate(weekRoute(workspace, data.start, addDays(data.start, Math.floor(i / 7) * 7)))

  const move = (delta: number): void => {
    const at = active === null ? Math.max(lastBegun, 0) : active + delta
    setActive(Math.max(firstDay, Math.min(lastDay, at)))
  }

  const tip = active === null ? null : days[active]
  const tipLeft = active === null ? 0 : Math.min(Math.max(cx(active) + cell / 2, 90), width - 90)

  return (
    <>
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
          <svg width={width} height={HEIGHT} aria-hidden>
            {months.map((m) => (
              <text key={m.column} className={styles.axis} x={PAD.left + m.column * step} y={12}>
                {MONTHS[m.month]}
              </text>
            ))}
            {DAY_NAMES.map((_, row) => (
              <text
                key={row}
                className={styles.axis}
                x={PAD.left - 8}
                y={PAD.top + row * stepY + cellH / 2 + 4}
                textAnchor="end"
              >
                {DAY_NAMES[(weekdayOf(data.start) - 1 + row) % 7]}
              </text>
            ))}
            {days.slice(firstDay, lastDay + 1).map((d, local) => {
              const i = firstDay + local
              return (
                <g key={d.date} onPointerEnter={() => setActive(i)} onClick={() => open(i)}>
                  <rect
                    className={[
                      styles[`level${d.level}`],
                      d.future ? styles.future : '',
                      d.off ? styles.off : '',
                      active === i ? styles.active : ''
                    ].join(' ')}
                    x={cx(i)}
                    y={cy(i)}
                    width={cell}
                    height={cellH}
                    rx={Math.min(3, cell / 4)}
                  />
                  {labelled && (
                    <text
                      className={`${styles.day} ${d.level >= 2 && !d.future ? styles.dayOnFill : ''}`}
                      x={cx(i) + cell / 2}
                      y={cy(i) + cell / 2 + 4}
                      textAnchor="middle"
                    >
                      {Number(d.date.slice(8, 10))}
                    </text>
                  )}
                </g>
              )
            })}
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
    </>
  )
}
