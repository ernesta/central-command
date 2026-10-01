import { useId, useState } from 'react'
import {
  addDays,
  currentYear,
  defaultNextStart,
  withNextStart,
  YEAR_DAYS,
  yearLabel
} from '@shared/year'
import { formatDate } from '@shared/time'
import { todayIso } from '@shared/time'
import { Input } from '../components/Input'
import { useSettings } from '../state/settings-context'
import styles from './PathField.module.css'

/** The shared year (52 weeks from a Monday): the current one's start, and when the next one starts. */
export function YearFields(): React.JSX.Element {
  const { settings, update } = useSettings()
  const nextId = useId()
  const today = todayIso()
  const starts = settings.yearStarts
  const current = currentYear(today, starts)
  const last = starts[starts.length - 1]
  const saved = last !== undefined && last > today ? last : defaultNextStart(starts, today)
  const [draft, setDraft] = useState(saved)
  const [seen, setSeen] = useState(saved)
  if (seen !== saved) {
    setSeen(saved)
    setDraft(saved)
  }
  const refused =
    draft !== saved && /^\d{4}-\d{2}-\d{2}$/.test(draft) && !withNextStart(starts, draft, today)

  const change = (value: string): void => {
    setDraft(value)
    const next = /^\d{4}-\d{2}-\d{2}$/.test(value) ? withNextStart(starts, value, today) : null
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
        <label htmlFor={nextId} className={styles.label}>
          Next year starts
        </label>
        <div className={styles.row}>
          <Input
            id={nextId}
            type="date"
            value={draft}
            min={addDays(current, YEAR_DAYS)}
            aria-invalid={refused || undefined}
            onChange={(event) => change(event.target.value)}
            onBlur={() => setDraft(saved)}
          />
        </div>
      </div>
    </>
  )
}
