import { HoursStrip } from '@renderer/components/HoursStrip'
import { meetingHours } from '../shared/hours'
import type { MeetingIndexRow } from '../shared/types'

/** Hours of meetings in one year, and hours per skill. */
export function MeetingsHours({
  rows,
  year,
  weeks,
  end,
  label,
  today,
  showSkills
}: {
  rows: readonly MeetingIndexRow[]
  year: string
  /** The period's length and name: a contract's in Work. */
  weeks: number
  end?: string
  label: string
  today: string
  showSkills: boolean
}): React.JSX.Element {
  const hours = meetingHours(rows, year, today, weeks, end)
  const note = `${hours.meetings} done`
  return (
    <HoursStrip
      title={`Hours of meetings, ${label}`}
      minutes={hours.minutes}
      note={note}
      perSkill={showSkills ? hours.perSkill : []}
    />
  )
}
