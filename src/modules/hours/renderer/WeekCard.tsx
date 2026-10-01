import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDay, formatHours, formatRange, formatSignedHours } from '@shared/tracking/format'
import { dailyAim, weekTotals } from '@shared/tracking/plan'
import { dayRows, weekDaysMinutes } from '@shared/tracking/totals'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { addDays, weekNumberOf, yearEnd } from '@shared/year'
import { earlierLabels } from '../shared/tasks'
import { barFill, BAR_SCALE } from '../shared/week'
import type { HoursWorkspace } from '../shared/workspaces'
import { AddTime } from './AddTime'
import { TaskList } from './TaskList'
import styles from './WeekCard.module.css'

interface WeekCardProps {
  workspace: HoursWorkspace
  data: TrackingYear
  /** The Monday of the week shown. */
  week: string
  onWeekChange: (week: string) => void
  now: Moment
}

/** One week at a time: seven days with their hours and a bar against the aim; a day opens its tasks. */
export function WeekCard({
  workspace,
  data,
  week,
  onWeekChange,
  now
}: WeekCardProps): React.JSX.Element {
  const [opened, setOpened] = useState<{ week: string; date: string } | null>(null)
  const open = opened?.week === week ? opened.date : null
  const labels = useMemo(() => earlierLabels(data), [data])
  const tracking = window.api.tracking

  const days = weekDaysMinutes(data, week, now)
  const perDay =
    data.plan.workDays.length > 0 ? data.plan.hoursPerWeek / data.plan.workDays.length : 0
  // The plan up to today and the balance come from the rules, so this agrees with the balance and the year.
  const totals = weekTotals(data, now.date, now).find((w) => w.from === week)
  const plan = totals?.plan ?? 0
  const through = plan + (totals?.balance ?? 0)
  const begun = week <= now.date
  const over = addDays(week, 6) < now.date
  const first = week <= data.start
  const last = addDays(week, 7) > yearEnd(data.start)
  const number = weekNumberOf(week, data.start)

  return (
    <section className={styles.card} aria-label="Week">
      <header className={styles.head}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous week"
            disabled={first}
            onClick={() => onWeekChange(addDays(week, -7))}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <span className={styles.label}>
            Week {number} · {formatRange(week, addDays(week, 6))}
          </span>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Next week"
            disabled={last}
            onClick={() => onWeekChange(addDays(week, 7))}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {begun && (
          <span className={styles.summary}>
            {formatHours(through)} of {formatHours(plan)}
            {over ? '' : ' so far'} · {formatSignedHours(through - plan)}
          </span>
        )}
      </header>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col" className={styles.right}>
              Hours
            </th>
            <th scope="col">Aim {perDay > 0 ? formatHours(perDay) : ''}</th>
          </tr>
        </thead>
        <tbody>
          {days.map(({ date, minutes }) => {
            const past = date <= now.date
            const aim = dailyAim(data, date)
            const shown = open === date
            const rows = shown ? dayRows(data, date, now) : []
            const imported = data.days[date]?.minutes ?? 0
            const note = data.days[date]?.note
            return (
              <DayRows
                key={date}
                date={date}
                minutes={minutes}
                past={past}
                today={date === now.date}
                aim={aim}
                perDay={perDay}
                expanded={shown}
                onToggle={() => setOpened(shown ? null : { week, date })}
              >
                {shown && (
                  <>
                    {imported > 0 && (
                      <div className={styles.imported}>
                        <span>Imported</span>
                        <span className={styles.importedTime}>{formatHours(imported)}</span>
                      </div>
                    )}
                    <TaskList
                      rows={rows}
                      onSetMinutes={(label, m) =>
                        void tracking.setTaskMinutes(workspace, data.start, date, label, m)
                      }
                    />
                    <AddTime
                      labels={labels}
                      onAdd={(label, m) =>
                        void tracking.addTime(workspace, data.start, date, label, m)
                      }
                    />
                    {note && <p className={styles.note}>{note}</p>}
                  </>
                )}
              </DayRows>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function DayRows({
  date,
  minutes,
  past,
  today,
  aim,
  perDay,
  expanded,
  onToggle,
  children
}: {
  date: string
  minutes: number
  past: boolean
  today: boolean
  aim: number | null
  perDay: number
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <tr
        className={styles.day}
        data-off={aim === null}
        data-open={expanded}
        onClick={past ? onToggle : undefined}
      >
        <td>
          {past ? (
            <button type="button" className={styles.dayButton} aria-expanded={expanded}>
              {formatDay(date)}
            </button>
          ) : (
            <span className={styles.dayName}>{formatDay(date)}</span>
          )}
          {today && <span className={styles.tag}>today</span>}
        </td>
        <td className={styles.right}>
          {past ? formatHours(minutes) : <span className={styles.muted}>—</span>}
        </td>
        <td>
          {past && (
            <div className={styles.track} aria-hidden>
              <i
                className={styles.fill}
                style={{ width: `${barFill(minutes, aim, perDay) * 100}%` }}
              />
              {aim !== null && (
                <b className={styles.tick} style={{ left: `${(1 / BAR_SCALE) * 100}%` }} />
              )}
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className={styles.detail}>
          <td colSpan={3}>
            <div className={styles.detailBody}>{children}</div>
          </td>
        </tr>
      )}
    </>
  )
}
