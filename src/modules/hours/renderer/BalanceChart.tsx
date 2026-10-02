import { useState } from 'react'
import { useElementWidth } from '@renderer/state/use-element-width'
import { formatHours, formatRange, formatSignedHours } from '@shared/tracking/format'
import { weekTotals } from '@shared/tracking/plan'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { linePath, niceRange, slotAt } from '../shared/chart'
import styles from './BalanceChart.module.css'

const HEIGHT = 220
const PAD = { top: 12, right: 8, bottom: 26, left: 52 }
const STEPS = [60, 120, 300, 600, 1200, 3000] // a tick every 1, 2, 5, 10, 20 or 50 hours

/** The running balance against the plan, at the end of each week so far: above zero is ahead, below is behind. */
export function BalanceChart({
  data,
  now
}: {
  data: TrackingYear
  now: Moment
}): React.JSX.Element {
  const { ref, width } = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const all = weekTotals(data, now.date, now)
  // Weeks that have not begun have no balance yet.
  const weeks = all.filter((w) => w.from <= now.date)

  const plotW = Math.max(width - PAD.left - PAD.right, 0)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const slot = plotW / all.length
  const balances = weeks.map((w) => w.yearBalance)
  const { bottom, top, ticks } = niceRange(
    Math.min(...balances, 0),
    Math.max(...balances, 0),
    STEPS
  )
  const y = (minutes: number): number =>
    PAD.top + plotH - ((minutes - bottom) / (top - bottom)) * plotH
  const x = (i: number): number => PAD.left + (i + 0.5) * slot
  const points = weeks.map((w, i) => ({ x: x(i), y: y(w.yearBalance) }))

  const move = (delta: number): void => {
    if (weeks.length === 0) return
    const at = active === null ? weeks.length - 1 : active + delta
    setActive(Math.max(0, Math.min(weeks.length - 1, at)))
  }

  const tip = active === null ? null : weeks[active]
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 100), width - 100)

  return (
    <section className={styles.card} aria-label="Running balance">
      <header className={styles.head}>
        <h2 className={styles.title}>Balance</h2>
        <p className={styles.note}>Hours ahead of or behind the plan, week by week</p>
      </header>
      <div
        ref={ref}
        className={styles.plot}
        tabIndex={0}
        role="group"
        aria-label="Running balance by week; arrow keys move between weeks"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            move(event.key === 'ArrowLeft' ? -1 : 1)
          } else if (event.key === 'Escape') setActive(null)
        }}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  className={t === 0 ? styles.zero : styles.grid}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text className={styles.axis} x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                  {formatSignedHours(t)}
                </text>
              </g>
            ))}
            {all.map((w, i) =>
              i % 4 === 0 ? (
                <text
                  key={w.from}
                  className={styles.axis}
                  x={x(i)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                >
                  {w.number}
                </text>
              ) : null
            )}
            <path className={styles.line} d={linePath(points)} />
            {active !== null && (
              <circle className={styles.dot} cx={points[active].x} cy={points[active].y} r={5} />
            )}
            {weeks.map((w, i) => (
              <rect
                key={w.from}
                className={styles.hit}
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                onPointerEnter={() => setActive(i)}
                onPointerMove={(e) => {
                  const at = slotAt(
                    e.clientX - e.currentTarget.ownerSVGElement!.getBoundingClientRect().left,
                    PAD.left,
                    slot,
                    all.length
                  )
                  if (at !== null && at < weeks.length) setActive(at)
                }}
              />
            ))}
          </svg>
        )}
        {tip && active !== null && (
          <div
            className={styles.tip}
            style={{ left: tipLeft, top: Math.max(points[active].y - 12, 8) }}
            role="status"
          >
            <strong className={styles.tipValue}>{formatSignedHours(tip.yearBalance)}</strong>
            <span className={styles.tipLine}>
              Week {tip.number} · {formatRange(tip.from, tip.to)}
            </span>
            <span className={styles.tipLine}>
              {formatHours(tip.minutes)} of {formatHours(tip.plan)}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
