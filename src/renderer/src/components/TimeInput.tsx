import { useRef } from 'react'
import { uses12HourClock } from '@shared/locale-names'
import { from12Hour, parseQuarterTime, parseTime, snapTime, stepTime, to12Hour } from './time-input'
import styles from './TimeInput.module.css'

interface TimeInputProps {
  /** Goes on the hours part, so a <label htmlFor> reaches the field. */
  id?: string
  'aria-label'?: string
  /** "HH:MM", or empty for no time. */
  value: string
  /** A complete time as "HH:MM", or null when the field is emptied. */
  onChange: (value: string | null) => void
}

type Part = 'hours' | 'minutes' | 'meridiem'

/**
 * A time of day as two parts, hours and minutes, like Hours' duration field: Tab lands on hours and again on minutes, a
 * click goes to the part clicked, and the part focused is selected. Digits are typed over it (hours move on to minutes
 * once complete); setting one part fills in the other (09 and 00); Up and Down step (an hour; a quarter hour, without
 * carrying); minutes always sit on 00, 15, 30 or 45 (typed 07 becomes 00); Backspace or Delete empties the whole time.
 * Where the Mac's region uses a 12-hour clock a third part holds AM or PM (A, P, Up and Down set it); the value stays 24-hour.
 */
export function TimeInput({ value, onChange, id, ...rest }: TimeInputProps): React.JSX.Element {
  const twelve = uses12HourClock()
  const refs = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    meridiem: useRef<HTMLInputElement>(null)
  }
  // The digits typed into the focused part so far; a new focus starts again.
  const typed = useRef('')
  const time = parseTime(value)
  const [hours24, minutes] = time ? time.split(':') : ['', '']
  const clock = time ? to12Hour(Number(hours24)) : null
  const hours = clock && twelve ? String(clock.hour).padStart(2, '0') : hours24

  const pad = (n: number): string => String(n).padStart(2, '0')
  const set = (part: 'hours' | 'minutes', n: number): void => {
    const [h, m] = (time ?? '09:00').split(':')
    onChange(
      snapTime(part === 'hours' ? `${pad(n)}:${time ? m : '00'}` : `${time ? h : '09'}:${pad(n)}`)
    )
  }
  const setMeridiem = (pm: boolean): void => {
    const [h, m] = (time ?? '09:00').split(':')
    onChange(`${pad(from12Hour(to12Hour(Number(h)).hour, pm))}:${m}`)
  }
  const go = (part: Part): void => {
    typed.current = ''
    refs[part].current?.focus()
  }

  const keys = (part: Part) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (part === 'meridiem') {
      if (/^[ap]$/i.test(key)) {
        event.preventDefault()
        setMeridiem(key.toLowerCase() === 'p')
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        event.preventDefault()
        setMeridiem(!(clock?.pm ?? false))
      } else if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault()
        onChange(null)
      } else if (key === 'ArrowLeft') {
        event.preventDefault()
        go('minutes')
      }
      return
    }
    if (/^\d$/.test(key)) {
      event.preventDefault()
      typed.current += key
      const digits = typed.current
      if (part === 'hours' && twelve) {
        const n = Math.min(12, Number(digits))
        if (n > 0) set('hours', from12Hour(n, clock?.pm ?? false))
        if (digits.length === 2 || Number(key) > 1) go('minutes')
      } else if (part === 'hours') {
        set('hours', Math.min(23, Number(digits)))
        if (digits.length === 2 || Number(key) > 2) go('minutes')
      } else {
        // One digit is the tens ("3" is 30); the time always sits on a quarter hour.
        set('minutes', Math.min(59, digits.length === 1 ? Number(digits) * 10 : Number(digits)))
        if (digits.length === 2) typed.current = ''
      }
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault()
      typed.current = ''
      onChange(stepTime(time ?? '', part, key === 'ArrowUp' ? 1 : -1))
    } else if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault()
      typed.current = ''
      onChange(null)
    } else if (part === 'hours' && (key === 'ArrowRight' || key === ':')) {
      event.preventDefault()
      go('minutes')
    } else if (part === 'minutes' && key === 'ArrowLeft') {
      event.preventDefault()
      go('hours')
    } else if (part === 'minutes' && twelve && key === 'ArrowRight') {
      event.preventDefault()
      go('meridiem')
    }
  }

  const part = (name: Part, text: string, label: string): React.JSX.Element => (
    <input
      ref={refs[name]}
      id={name === 'hours' ? id : undefined}
      className={styles.part}
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder="--"
      value={text}
      // Every key is handled above; a paste of a whole time is the one thing that arrives as a change.
      readOnly={name === 'meridiem'}
      onChange={(event) => {
        const pasted = parseQuarterTime(event.target.value)
        if (pasted) onChange(pasted)
      }}
      onKeyDown={keys(name)}
      onFocus={(event) => {
        typed.current = ''
        event.target.select()
      }}
    />
  )

  return (
    <div className={styles.field} role="group" aria-label={rest['aria-label'] ?? 'Time'}>
      {part('hours', hours, 'Hours')}
      <span className={styles.colon} aria-hidden>
        :
      </span>
      {part('minutes', minutes, 'Minutes')}
      {twelve && part('meridiem', clock ? (clock.pm ? 'PM' : 'AM') : '', 'AM or PM')}
    </div>
  )
}
