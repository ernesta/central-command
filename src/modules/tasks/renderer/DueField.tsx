import { DatePicker } from '@renderer/components/DatePicker'

/** A due date: a button that opens a calendar, with Today and No date inside it. */
export function DueField({
  value,
  today,
  onChange,
  label = 'Due'
}: {
  value: string | null
  today: string
  onChange: (due: string | null) => void
  label?: string
}): React.JSX.Element {
  return <DatePicker label={label} value={value} today={today} onChange={onChange} />
}
