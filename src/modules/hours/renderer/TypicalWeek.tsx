import { useState } from 'react'
import { useElementWidth } from '@renderer/state/use-element-width'
import { formatHours } from '@shared/tracking/format'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { columnPath, niceAxis, slotAt } from '../shared/chart'
import { typicalWeek } from '../shared/typical'
import styles from './TypicalWeek.module.css'

const HEIGHT = 200
const PAD = { top: 22, right: 8, bottom: 26, left: 52 }
const MAX_BAR = 56
const RADIUS = 4
const STEP = 120 // a tick every 2 hours
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The typical week: the average hours on each weekday so far, weekends kept, against the daily aim. */
export function TypicalWeek({ data, now }: { data: TrackingYear; now: Moment }): React.JSX.Element {
  const { ref, width } = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const week = typicalWeek(data, now)

  const plotW = Math.max(width - PAD.left - PAD.right, 0)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const slot = plotW / 7
  const barW = Math.min(MAX_BAR, Math.max(slot - 16, 1))
  const { top, ticks } = niceAxis(
    Math.max(...week.map((d) => Math.max(d.average, d.aim ?? 0)), 0),
    STEP
  )
  const y = (minutes: number): number => PAD.top + plotH - (minutes / top) * plotH
  const centre = (i: number): number => PAD.left + (i + 0.5) * slot

  const tip = active === null ? null : week[active]
  const tipLeft = active === null ? 0 : Math.min(Math.max(centre(active), 80), width - 80)

  return (
    <section className={styles.card} aria-label="The typical week">
      <header className={styles.head}>
        <h2 className={styles.title}>Typical week</h2>
        <ul className={styles.legend}>
          <li>
            <b className={styles.aimKey} />
            Daily aim
          </li>
        </ul>
      </header>
      <div
        ref={ref}
        className={styles.plot}
        tabIndex={0}
        role="group"
        aria-label="Average hours on each weekday; arrow keys move between days"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            const next =
              (active ?? (event.key === 'ArrowRight' ? -1 : 7)) +
              (event.key === 'ArrowLeft' ? -1 : 1)
            setActive(Math.max(0, Math.min(6, next)))
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
            {week.map((d, i) => (
              <g key={d.weekday}>
                <path
                  className={`${styles.bar} ${active === i ? styles.lift : ''}`}
                  d={columnPath(
                    centre(i) - barW / 2,
                    y(d.average),
                    barW,
                    y(0) - y(d.average),
                    RADIUS
                  )}
                />
                {d.aim !== null && (
                  <line
                    className={styles.aim}
                    x1={centre(i) - slot / 2 + 6}
                    x2={centre(i) + slot / 2 - 6}
                    y1={y(d.aim)}
                    y2={y(d.aim)}
                  />
                )}
                <text
                  className={styles.value}
                  x={centre(i)}
                  y={y(d.average) - 6}
                  textAnchor="middle"
                >
                  {d.days > 0 ? formatHours(d.average) : ''}
                </text>
                <text className={styles.axis} x={centre(i)} y={HEIGHT - 6} textAnchor="middle">
                  {DAYS[i]}
                </text>
                <rect
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
                      7
                    )
                    if (at !== null) setActive(at)
                  }}
                />
              </g>
            ))}
          </svg>
        )}
        {tip && active !== null && (
          <div
            className={styles.tip}
            style={{ left: tipLeft, top: Math.max(y(Math.max(tip.average, tip.aim ?? 0)) - 28, 8) }}
            role="status"
          >
            <strong className={styles.tipValue}>{formatHours(tip.average)}</strong>
            <span className={styles.tipLine}>
              {DAYS[active]} · average of {tip.days} {tip.days === 1 ? 'day' : 'days'}
            </span>
            {tip.aim !== null && <span className={styles.tipLine}>Aim {formatHours(tip.aim)}</span>}
          </div>
        )}
      </div>
    </section>
  )
}
