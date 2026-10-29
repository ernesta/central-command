import { useToday } from '@renderer/state/use-today'
import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { DatePicker } from '@renderer/components/DatePicker'
import { useSettings } from '@renderer/state/settings-context'
import { formatDate } from '@shared/time'
import { defaultNextStart, withNextStart, yearEnd, yearLabel } from '@shared/year'
import styles from './YearsTable.module.css'

/** The next year's row: its start can be moved until the year begins. */
function NextYearRow({ start, starts }: { start: string; starts: string[] }): React.JSX.Element {
  const { update } = useSettings()
  const today = useToday()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(start)
  // Only a Monday far enough after the current year, and still ahead, is offered, so nothing chosen is ever refused.
  const next = withNextStart(starts, draft, today)
  const done = (): void => {
    setEditing(false)
    setDraft(start)
  }
  const save = (): void => {
    if (next) void update({ yearStarts: next })
    setEditing(false)
  }

  if (!editing)
    return (
      <tr>
        <th scope="row">{yearLabel(start)}</th>
        <td>{formatDate(start)}</td>
        <td>{formatDate(yearEnd(start))}</td>
        <td className={styles.actions}>
          <Button
            size="small"
            aria-label={`Edit ${yearLabel(start)}`}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </td>
      </tr>
    )
  return (
    <tr
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          done()
        }
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) save()
      }}
    >
      <th scope="row">{yearLabel(draft)}</th>
      <td>
        <DatePicker
          label="Next year starts"
          value={draft}
          today={today}
          full
          clearable={false}
          isDisabled={(date) => withNextStart(starts, date, today) === null}
          onChange={(day) => day && setDraft(day)}
        />
      </td>
      <td>{formatDate(yearEnd(draft))}</td>
      <td className={styles.actions}>
        <Button size="small" variant="primary" disabled={!next} onClick={save}>
          Save
        </Button>
        <Button size="small" onClick={done}>
          Cancel
        </Button>
      </td>
    </tr>
  )
}

/** Research's years, newest first: each lasts 52 weeks from a Monday. Only the next one, until it begins, has Edit. */
export function YearsTable(): React.JSX.Element {
  const { settings } = useSettings()
  const today = useToday()
  const starts = settings.yearStarts
  const last = starts[starts.length - 1]
  const upcoming = last !== undefined && last > today ? last : defaultNextStart(starts, today)
  const rows = [...new Set([...starts, upcoming])].sort().reverse()

  return (
    <section className={styles.card} aria-label="Years">
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Starts</th>
              <th scope="col">Ends</th>
              <th scope="col">
                <span className={styles.hidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((start) =>
              start === upcoming ? (
                // A saved start is a new row, so a stale draft never carries over.
                <NextYearRow key={start} start={start} starts={starts} />
              ) : (
                <tr key={start}>
                  <th scope="row">{yearLabel(start)}</th>
                  <td>{formatDate(start)}</td>
                  <td>{formatDate(yearEnd(start))}</td>
                  <td />
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
