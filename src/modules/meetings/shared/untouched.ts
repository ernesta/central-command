import { NEW_MEETING_BODY } from './front-matter'
import type { MeetingMeta } from './types'

const lines = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')

/**
 * Whether a meeting is still exactly what New meeting made: no series, no times, no mode, no attendees, no skills, nothing discussed,
 * and a body that is the template's headings and nothing else (blank lines aside). Such a meeting is litter, not a note: leaving it
 * removes it with its task. The date is not a change (a new meeting is prefilled with today's; setting it differently alone is not
 * writing a meeting). A task other than the app's own `auto` marker or a uid it made is not looked at here: the store decides.
 */
export function isUntouchedMeeting(meta: MeetingMeta, body: string): boolean {
  return (
    meta.series.trim() === '' &&
    meta.start === null &&
    meta.end === null &&
    meta.mode === null &&
    meta.attendees.length === 0 &&
    meta.skills.length === 0 &&
    meta.discussed.length === 0 &&
    lines(body) === lines(NEW_MEETING_BODY)
  )
}
