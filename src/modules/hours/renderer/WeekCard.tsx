import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDay, formatHours, formatRange } from '@shared/tracking/format'
import { dailyAim, hasAim } from '@shared/tracking/plan'
import { dayRows, weekDaysMinutes } from '@shared/tracking/totals'
import { invoiceOf, type Moment, type TrackingYear } from '@shared/tracking/types'
import { addDays, weekNumberOf, yearEnd } from '@shared/year'
import { periodOfWeek, periodsOf } from '../shared/periods'
import { weekFigures } from '../shared/so-far'
import { barFill, BAR_SCALE } from '../shared/week'
import type { HoursWorkspace } from '../shared/workspaces'
import { AddTime } from './AddTime'
import { PeriodSummary } from './PeriodSummary'
import { MeetingRows } from './MeetingRows'
import { ImportedIcon } from './ImportedIcon'
import { TaskList } from './TaskList'
import { renameRow } from './rename-row'
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
  const tracking = window.api.tracking

  const days = weekDaysMinutes(data, week, now)
  // Where the aim is the whole week's there is none per day: a day's bar is its share of the week's hours.
  const perDay = data.plan.weekAim
    ? data.plan.hoursPerWeek
    : data.plan.workDays.length > 0
      ? data.plan.hoursPerWeek / data.plan.workDays.length
      : 0
  // The summary is against the whole week's aim (the rules' plan for the week's last day), not what is expected so far.
  const { aim, minutes: worked } = weekFigures(data, week, now)
  const aimed = hasAim(data)
  const first = week <= data.start
  const last = addDays(week, 7) > yearEnd(data.start, data.weeks)
  // Where weeks belong to invoice months they are numbered within the month.
  const number =
    data.plan.weekAim && invoiceOf(data) === 'month'
      ? periodOfWeek(periodsOf(data, now), week)?.weeks.find((w) => w.from === week)?.number
      : weekNumberOf(week, data.start, data.weeks)

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
      </header>
      {aimed ? (
        <PeriodSummary minutes={worked} aim={aim} />
      ) : (
        <p className={styles.total}>{formatHours(worked)}</p>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col" className={styles.right}>
              Hours
            </th>
            {aimed && (
              <th scope="col">
                {data.plan.weekAim ? '' : `Aim ${perDay > 0 ? formatHours(perDay) : ''}`}
              </th>
            )}
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
                bar={aimed}
                expanded={shown}
                onToggle={() => setOpened(shown ? null : { week, date })}
              >
                {shown && (
                  <>
                    {imported > 0 && (
                      <div className={styles.imported}>
                        <ImportedIcon className={styles.importedIcon} />
                        <span>Imported</span>
                        <span className={styles.importedTime}>{formatHours(imported)}</span>
                      </div>
                    )}
                    <TaskList
                      workspace={workspace}
                      rows={rows}
                      clients={data.plan.clients}
                      onSetClient={(label, from, to) =>
                        void tracking.setClient(workspace, data.start, date, label, from, to)
                      }
                      onRename={(label, to, client, task) =>
                        renameRow(workspace, data.start, date, { label, client, task }, to)
                      }
                      onDelete={(label, client) =>
                        void tracking.deleteTaskTime(workspace, data.start, date, label, client)
                      }
                      onSetMinutes={(label, m, client, task) =>
                        void tracking.setTaskMinutes(
                          workspace,
                          data.start,
                          date,
                          label,
                          m,
                          client,
                          task
                        )
                      }
                    />
                    <MeetingRows workspace={workspace} data={data} date={date} now={now} />
                    <AddTime
                      workspace={workspace}
                      clients={data.plan.clients}
                      onAdd={(task, m) =>
                        void tracking.addTime(
                          workspace,
                          data.start,
                          date,
                          task.label,
                          m,
                          task.client,
                          task.task
                        )
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
  bar,
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
  /** Whether a bar is drawn (a day's share of the aim: none where there is no aim). */
  bar: boolean
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
        data-today={today || undefined}
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
        </td>
        <td className={styles.right}>
          {past ? formatHours(minutes) : <span className={styles.muted}>—</span>}
        </td>
        {bar && (
          <td>
            <div className={styles.track} aria-hidden>
              <i
                className={styles.fill}
                style={{ width: `${past ? barFill(minutes, aim, perDay) * 100 : 0}%` }}
              />
              {aim !== null && (
                <b className={styles.tick} style={{ left: `${(1 / BAR_SCALE) * 100}%` }} />
              )}
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr className={styles.detail}>
          <td colSpan={bar ? 3 : 2}>
            <div className={styles.detailBody}>{children}</div>
          </td>
        </tr>
      )}
    </>
  )
}
