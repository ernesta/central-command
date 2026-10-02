import { useRef, useState } from 'react'
import { parseTime, stepTime } from './time-input'

interface TimeInputProps {
  id?: string
  className?: string
  'aria-label'?: string
  /** "HH:MM", or empty for no time. */
  value: string
  /** A complete time as "HH:MM", or null when the field is emptied. Half-typed text is not reported. */
  onChange: (value: string | null) => void
}

/** A time typed with the keyboard (no clock icon, no picker); Up and Down step the part the cursor is in. */
export function TimeInput({ value, onChange, ...rest }: TimeInputProps): React.JSX.Element {
  // What is on screen while the field is being typed in; null shows the saved value.
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="--:--"
      maxLength={5}
      value={draft ?? value}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        if (raw.trim() === '') onChange(null)
        else {
          const time = parseTime(raw)
          if (time) onChange(time)
        }
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
        event.preventDefault()
        const input = event.currentTarget
        const caret = input.selectionStart ?? 0
        const colon = (draft ?? value).indexOf(':')
        const part = colon === -1 || caret <= colon ? 'hours' : 'minutes'
        const next = stepTime(draft ?? value, part, event.key === 'ArrowUp' ? 1 : -1)
        setDraft(next)
        onChange(next)
        // Keep the cursor in the same part, with its digits selected so the next press carries on.
        requestAnimationFrame(() => {
          if (part === 'hours') input.setSelectionRange(0, 2)
          else input.setSelectionRange(3, 5)
        })
      }}
    />
  )
}
