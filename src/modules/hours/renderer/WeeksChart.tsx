import { useState } from 'react'
import { useElementWidth } from '@renderer/state/use-element-width'
import { formatHours, formatRange, formatSignedHours } from '@shared/tracking/format'
import { hasAim, weekPlan, weekTotals } from '@shared/tracking/plan'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { columnPath, niceAxis, slotAt } from '../shared/chart'
import styles from './WeeksChart.module.css'

const HEIGHT = 240
const PAD = { top: 12, right: 8, bottom: 26, left: 52 }
const MAX_BAR = 24
const GAP = 2
const RADIUS = 4
const STEP = 600 // a tick every 10 hours

/**
 * The weeks of the year as columns against the weekly plan: met in the accent, under in `--chart-under`. With no aim they
 * are all in the accent, with no plan line.
 */
export function WeeksChart({ data, now }: { data: TrackingYear; now: Moment }): React.JSX.Element {
  const { ref, width } = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const aimed = hasAim(data)
  const weeks = weekTotals(data, now.date, now).map((w) => ({
    ...w,
    // The plan for the whole week, drawn for every week; `w.plan` is only the part up to today.
    fullPlan: weekPlan(data, w.from)
  }))

  const plotW = Math.max(width - PAD.left - PAD.right, 0)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const slot = plotW / weeks.length
  const barW = Math.min(MAX_BAR, Math.max(slot - GAP, 1))
  const { top, ticks } = niceAxis(
    Math.max(...weeks.map((w) => Math.max(w.minutes, w.fullPlan)), 0),
    STEP
  )
  const y = (minutes: number): number => PAD.top + plotH - (minutes / top) * plotH
  const begun = (i: number): boolean => weeks[i].from <= now.date

  const planPath = weeks
    .map(
      (w, i) =>
        `${i === 0 ? 'M' : 'L'}${PAD.left + i * slot} ${y(w.fullPlan)}L${PAD.left + (i + 1) * slot} ${y(w.fullPlan)}`
    )
    .join('')

  const move = (delta: number): void => {
    const shown = weeks.map((_, i) => i).filter(begun)
    if (shown.length === 0) return
    const at = active === null ? shown[shown.length - 1] : active + delta
    setActive(Math.max(shown[0], Math.min(shown[shown.length - 1], at)))
  }

  const tip = active === null ? null : weeks[active]
  // The tooltip is about 190px wide and centred on its week; keep it inside the plot at either end.
  const tipLeft =
    active === null ? 0 : Math.min(Math.max(PAD.left + (active + 0.5) * slot, 100), width - 100)

  return (
    <section className={styles.card} aria-label={aimed ? 'Weeks against the plan' : 'Weeks'}>
      <header className={styles.head}>
        <h2 className={styles.title}>Weeks</h2>
        <ul className={styles.legend}>
          {!aimed && (
            <li>
              <i className={styles.met} />
              Hours
            </li>
          )}
          {aimed && (
            <>
              <li>
                <i className={styles.met} />
                Plan met
              </li>
              <li>
                <i className={styles.under} />
                Under plan
              </li>
            </>
          )}
          <li>
            <i className={styles.now} />
            This week
          </li>
          {aimed && (
            <li>
              <b className={styles.planKey} />
              Plan
            </li>
          )}
        </ul>
      </header>
      <div
        ref={ref}
        className={styles.plot}
        tabIndex={0}
        role="group"
        aria-label={`Hours a week${aimed ? ' against the plan' : ''}; arrow keys move between weeks`}
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
                  className={styles.grid}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text className={styles.axis} x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                  {formatHours(t)}
                </text>
              </g>
            ))}
            {weeks.map((w, i) => {
              if (i % 4 === 0)
                return (
                  <text
                    key={`l${w.from}`}
                    className={styles.axis}
                    x={PAD.left + (i + 0.5) * slot}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                  >
                    {w.number}
                  </text>
                )
              return null
            })}
            {weeks.map((w, i) => {
              if (!begun(i) || w.minutes <= 0) return null
              const x = PAD.left + i * slot + (slot - barW) / 2
              const kind = w.inProgress
                ? styles.now
                : w.minutes >= w.fullPlan
                  ? styles.met
                  : styles.under
              return (
                <path
                  key={w.from}
                  className={`${kind} ${active === i ? styles.lift : ''}`}
                  d={columnPath(x, y(w.minutes), barW, y(0) - y(w.minutes), RADIUS)}
                />
              )
            })}
            {aimed && <path className={styles.plan} d={planPath} />}
            {weeks.map((w, i) =>
              begun(i) ? (
                <rect
                  key={`h${w.from}`}
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
                      weeks.length
                    )
                    if (at !== null && begun(at)) setActive(at)
                  }}
                />
              ) : null
            )}
          </svg>
        )}
        {tip && (
          <div
            className={styles.tip}
            style={{ left: tipLeft, top: Math.max(y(Math.max(tip.minutes, tip.fullPlan)) - 8, 8) }}
            role="status"
          >
            <strong className={styles.tipValue}>{formatHours(tip.minutes)}</strong>
            <span className={styles.tipLine}>
              Week {tip.number} · {formatRange(tip.from, tip.to)}
            </span>
            {aimed && (
              <span className={styles.tipLine}>
                Plan {formatHours(tip.fullPlan)}
                {tip.inProgress ? '' : ` · ${formatSignedHours(tip.minutes - tip.fullPlan)}`}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
