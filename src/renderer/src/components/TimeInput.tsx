import { useRef } from 'react'
import { parseTime, stepTime } from './time-input'
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

type Part = 'hours' | 'minutes'

/**
 * A time of day as two parts, hours and minutes, like Hours' duration field: Tab lands on hours and again on minutes, a
 * click goes to the part clicked, and the part focused is selected. Digits are typed over it (hours move on to minutes
 * once complete); setting one part fills in the other (09 and 00); Up and Down step (an hour; a quarter hour, without
 * carrying); Backspace or Delete empties the whole time.
 */
export function TimeInput({ value, onChange, id, ...rest }: TimeInputProps): React.JSX.Element {
  const refs = { hours: useRef<HTMLInputElement>(null), minutes: useRef<HTMLInputElement>(null) }
  // The digits typed into the focused part so far; a new focus starts again.
  const typed = useRef('')
  const time = parseTime(value)
  const [hours, minutes] = time ? time.split(':') : ['', '']

  const pad = (n: number): string => String(n).padStart(2, '0')
  const set = (part: Part, n: number): void => {
    const [h, m] = (time ?? '09:00').split(':')
    onChange(part === 'hours' ? `${pad(n)}:${time ? m : '00'}` : `${time ? h : '09'}:${pad(n)}`)
  }
  const go = (part: Part): void => {
    typed.current = ''
    refs[part].current?.focus()
  }

  const keys = (part: Part) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (/^\d$/.test(key)) {
      event.preventDefault()
      typed.current += key
      const digits = typed.current
      if (part === 'hours') {
        set('hours', Math.min(23, Number(digits)))
        if (digits.length === 2 || Number(key) > 2) go('minutes')
      } else {
        set('minutes', Math.min(59, Number(digits)))
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
      onChange={(event) => {
        const pasted = parseTime(event.target.value)
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
    </div>
  )
}
