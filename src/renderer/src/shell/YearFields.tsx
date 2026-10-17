import { currentYear, defaultNextStart, withNextStart, yearLabel } from '@shared/year'
import { formatDate } from '@shared/time'
import { todayIso } from '@shared/time'
import { DatePicker } from '../components/DatePicker'
import { useSettings } from '../state/settings-context'
import styles from './PathField.module.css'

/** The shared year (52 weeks from a Monday): the current one's start, and when the next one starts. */
export function YearFields(): React.JSX.Element {
  const { settings, update } = useSettings()
  const today = todayIso()
  const starts = settings.yearStarts
  const current = currentYear(today, starts)
  const last = starts[starts.length - 1]
  const saved = last !== undefined && last > today ? last : defaultNextStart(starts, today)
  // Only a Monday far enough after the current year, and still ahead, is offered, so nothing chosen is ever refused.
  const allowed = (date: string): boolean => withNextStart(starts, date, today) !== null
  const change = (value: string | null): void => {
    const next = value === null ? null : withNextStart(starts, value, today)
    if (next) void update({ yearStarts: next })
  }

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label} id="year-starts-label">
          Year starts
        </span>
        <output aria-labelledby="year-starts-label">
          {formatDate(current)} · {yearLabel(current)}
        </output>
      </div>
      <div className={styles.field}>
        <span className={styles.label} id="next-year-label">
          Next year starts
        </span>
        <div className={styles.row}>
          <DatePicker
            label="Next year starts"
            value={saved}
            today={today}
            full
            clearable={false}
            isDisabled={(date) => !allowed(date)}
            onChange={change}
          />
        </div>
      </div>
    </>
  )
}
