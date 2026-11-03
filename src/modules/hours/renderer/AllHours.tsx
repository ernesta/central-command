import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useYearFiles } from '@renderer/state/use-year-files'
import { formatDay, formatHours, formatRange } from '@shared/tracking/format'
import {
  allDay,
  allWeek,
  resolveAllWeek,
  weekBounds,
  workWeekStart,
  type ContractShare
} from '@shared/tracking/scope'
import type { Moment } from '@shared/tracking/types'
import { addDays } from '@shared/year'
import { BackToToday } from './BackToToday'
import { useShownYears } from './useMeetingHours'
import styles from './AllHours.module.css'

/** The week under All, kept in the URL (`?week=`, its Friday) like the Hours page's own. */
function useAllWeek(
  years: Parameters<typeof resolveAllWeek>[1],
  today: string
): { week: string; setWeek: (week: string) => void } {
  const [params, setParams] = useSearchParams()
  const week = resolveAllWeek(params.get('week'), years, today)
  const setWeek = (next: string): void =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('week', next)
        return p
      },
      { replace: true }
    )
  return { week, setWeek }
}

/** A contract with its hours, and under it the clients that have time: hours only. */
function Shares({
  shares,
  className
}: {
  shares: readonly ContractShare[]
  className: string
}): React.JSX.Element {
  return (
    <ul className={className}>
      {shares.map((c) => (
        <li key={c.year} className={styles.group}>
          <div className={styles.contract} data-empty={c.minutes === 0 || undefined}>
            <span>{c.name ?? c.year}</span>
            <span className={styles.num}>{formatHours(c.minutes)}</span>
          </div>
          {/* A contract with one client of its own name (Royal Holloway) says it once. */}
          {c.clients.length > 0 && !(c.clients.length === 1 && c.clients[0].client === c.name) && (
            <ul className={styles.clients}>
              {c.clients.map((cl) => (
                <li key={cl.client ?? ''} className={styles.client}>
                  <span>{cl.client ?? 'No client'}</span>
                  <span className={styles.num}>{formatHours(cl.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The Hours page under All contracts (`docs/WORK_CONTRACT_FILTER_PLAN.md`): today and Work's week summed over every contract, each
 * contract's hours by client, and nothing else. Read only: the timer, adding time and editing belong to one contract's page. No aim,
 * balance, invoice, export or charts: none of them means anything across contracts. `starts` are the contracts' first days.
 */
export function AllHours({
  starts,
  now
}: {
  starts: readonly string[]
  now: Moment
}): React.JSX.Element | null {
  const files = useYearFiles('work', starts)
  const years = useShownYears('work', files, now.date)
  const { week, setWeek } = useAllWeek(years ?? [], now.date)
  if (!years) return null

  const day = allDay(years, now.date, now)
  const thisWeek = workWeekStart(now.date)
  const bounds = weekBounds(years)
  const shown = allWeek(years, week, now)

  return (
    <>
      <section className={styles.card} aria-label="Today">
        <header className={styles.head}>
          <h2 className={styles.title}>
            Today <span className={styles.date}>{formatDay(now.date)}</span>
          </h2>
          <span className={styles.total}>{formatHours(day.minutes)}</span>
        </header>
        {day.contracts.length > 0 ? (
          <Shares shares={day.contracts} className={styles.groups} />
        ) : (
          <p className={styles.none}>No contract today.</p>
        )}
      </section>

      <section className={styles.weekCard} aria-label="Week">
        <header className={styles.weekHead}>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.arrow}
              aria-label="Previous week"
              disabled={!bounds || week <= bounds.first}
              onClick={() => setWeek(addDays(week, -7))}
            >
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
            </button>
            <span className={styles.label}>{formatRange(shown.from, shown.to)}</span>
            <button
              type="button"
              className={styles.arrow}
              aria-label="Next week"
              disabled={!bounds || week >= bounds.last}
              onClick={() => setWeek(addDays(week, 7))}
            >
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          {week !== thisWeek && <BackToToday label="This week" onClick={() => setWeek(thisWeek)} />}
        </header>
        <p className={styles.weekTotal}>{formatHours(shown.minutes)}</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className={styles.right}>
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.days.map((d) => (
              <tr key={d.date} className={styles.day} data-today={d.date === now.date || undefined}>
                <td>{formatDay(d.date)}</td>
                <td className={styles.right}>
                  {d.date <= now.date ? (
                    formatHours(d.minutes)
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.contracts.length > 0 && (
          <Shares shares={shown.contracts} className={styles.weekGroups} />
        )}
      </section>
    </>
  )
}
