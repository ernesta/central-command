import { academicYearLabel } from '@shared/academic-year'
import { HoursStrip } from '@renderer/components/HoursStrip'
import { meetingHours } from '../shared/hours'
import type { MeetingIndexRow } from '../shared/types'

/** Hours of meetings in one academic year, and hours per skill. */
export function MeetingsHours({
  rows,
  year,
  today
}: {
  rows: readonly MeetingIndexRow[]
  year: number
  today: string
}): React.JSX.Element {
  const hours = meetingHours(rows, year, today)
  const note = [
    `${hours.meetings} ${hours.meetings === 1 ? 'meeting' : 'meetings'}`,
    hours.withoutTimes > 0 ? `${hours.withoutTimes} without times, counted as 0` : ''
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <HoursStrip
      title={`Hours of meetings, ${academicYearLabel(year)}`}
      minutes={hours.minutes}
      note={note}
      perSkill={hours.perSkill}
    />
  )
}
