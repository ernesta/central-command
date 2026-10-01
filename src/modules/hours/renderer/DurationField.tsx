import { useRef } from 'react'
import { QUARTER } from '@shared/tracking/rounding'
import styles from './DurationField.module.css'

interface DurationFieldProps {
  /** Minutes; always shown as hours and minutes, zeros included. */
  value: number
  onChange: (minutes: number) => void
  label: string
  autoFocus?: boolean
  /** Enter pressed in either part. */
  onEnter?: () => void
  onEscape?: () => void
  /** Focus left the whole field (not just moved between its two parts). */
  onBlur?: () => void
}

const MAX = 999 * 60 + 59

/**
 * Time as two parts, hours and minutes, always filled (0 and 00). Tab lands on hours; Tab or Right (at the end of the
 * hours) moves to minutes; Left (at the start of the minutes) moves back; a click goes to the part clicked. Digits
 * are typed over the selected part; Up and Down step (an hour; a quarter hour, carrying into the hours).
 */
export function DurationField({
  value,
  onChange,
  label,
  autoFocus,
  onEnter,
  onEscape,
  onBlur
}: DurationFieldProps): React.JSX.Element {
  const hoursRef = useRef<HTMLInputElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const hours = Math.floor(value / 60)
  const minutes = value % 60

  const set = (total: number): void => onChange(Math.min(MAX, Math.max(0, total)))
  const atEnd = (el: HTMLInputElement): boolean =>
    el.selectionStart === el.value.length && el.selectionEnd === el.value.length
  const atStart = (el: HTMLInputElement): boolean =>
    el.selectionStart === 0 && el.selectionEnd === 0

  const common = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onEnter?.()
    } else if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      event.stopPropagation()
      onEscape()
    }
  }

  const hoursKeys = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    common(event)
    if (event.key === 'ArrowRight' && atEnd(event.currentTarget)) {
      event.preventDefault()
      minutesRef.current?.focus()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      set(value + (event.key === 'ArrowUp' ? 60 : -60))
    } else if (event.key === ':') {
      event.preventDefault()
      minutesRef.current?.focus()
    }
  }

  const minutesKeys = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    common(event)
    if ((event.key === 'ArrowLeft' || event.key === 'Backspace') && atStart(event.currentTarget)) {
      event.preventDefault()
      hoursRef.current?.focus()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      set(value + (event.key === 'ArrowUp' ? QUARTER : -QUARTER))
    }
  }

  const typedHours = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const digits = event.target.value.replace(/\D/g, '').slice(-3)
    set((digits === '' ? 0 : Number(digits)) * 60 + minutes)
  }
  const typedMinutes = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const digits = event.target.value.replace(/\D/g, '').slice(-2)
    set(hours * 60 + Math.min(59, digits === '' ? 0 : Number(digits)))
  }

  const focusMoved = (event: React.FocusEvent): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.()
  }

  return (
    <div className={styles.field} role="group" aria-label={label} onBlur={focusMoved}>
      <input
        ref={hoursRef}
        className={styles.part}
        aria-label="Hours"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={String(hours)}
        onChange={typedHours}
        onKeyDown={hoursKeys}
        onFocus={(event) => event.target.select()}
      />
      <span className={styles.colon} aria-hidden>
        :
      </span>
      <input
        ref={minutesRef}
        className={styles.part}
        aria-label="Minutes"
        inputMode="numeric"
        value={String(minutes).padStart(2, '0')}
        onChange={typedMinutes}
        onKeyDown={minutesKeys}
        onFocus={(event) => event.target.select()}
      />
    </div>
  )
}
