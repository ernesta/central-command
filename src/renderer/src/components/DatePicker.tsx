import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDate, formatShortDate } from '@shared/time'
import { monthGrid, monthOf, shiftMonth } from './calendar'
import styles from './DatePicker.module.css'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/**
 * A date as a button that opens a calendar: one click on a day sets it and closes, with Today and No date in the
 * calendar itself. The button reads "Today" or the date, or the placeholder when there is none.
 */
export function DatePicker({
  value,
  today,
  onChange,
  label,
  placeholder = 'No date',
  clearable = true
}: {
  value: string | null
  today: string
  onChange: (date: string | null) => void
  label: string
  placeholder?: string
  clearable?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(monthOf(value ?? today))
  const wrapRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = (date: string | null): void => {
    setOpen(false)
    buttonRef.current?.focus()
    if (date !== value) onChange(date)
  }

  const text =
    value === null
      ? placeholder
      : value === today
        ? 'Today'
        : value.slice(0, 4) === today.slice(0, 4)
          ? formatShortDate(value)
          : formatDate(value)

  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          buttonRef.current?.focus()
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={[styles.button, value === null && styles.empty].filter(Boolean).join(' ')}
        aria-label={`${label}: ${text}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMonth(monthOf(value ?? today))
          setOpen((o) => !o)
        }}
      >
        <CalendarDays size={14} strokeWidth={1.75} aria-hidden />
        {text}
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label={`${label} calendar`}>
          <div className={styles.head}>
            <button
              type="button"
              className={styles.nav}
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
            </button>
            <span className={styles.month} aria-live="polite">
              {MONTH_NAMES[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
            </span>
            <button
              type="button"
              className={styles.nav}
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className={styles.grid}>
            {WEEKDAYS.map((d, i) => (
              <span key={i} className={styles.weekday} aria-hidden>
                {d}
              </span>
            ))}
            {monthGrid(month).map((day) => (
              <button
                key={day}
                type="button"
                autoFocus={day === (value ?? today) && monthOf(day) === month}
                className={[
                  styles.day,
                  monthOf(day) !== month && styles.outside,
                  day === today && styles.today,
                  day === value && styles.selected
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={formatDate(day)}
                aria-pressed={day === value}
                onClick={() => choose(day)}
              >
                {Number(day.slice(8))}
              </button>
            ))}
          </div>
          <div className={styles.foot}>
            <button type="button" className={styles.quick} onClick={() => choose(today)}>
              Today
            </button>
            {clearable && (
              <button type="button" className={styles.quick} onClick={() => choose(null)}>
                No date
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  )
}
