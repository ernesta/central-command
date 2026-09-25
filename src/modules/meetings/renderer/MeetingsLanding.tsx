import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { AcademicYearSelect } from '@renderer/components/AcademicYearSelect'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  AllLink,
  LandingHeader,
  LandingHint,
  LandingPage,
  LandingSection,
  RecentList,
  SeeAllLink,
  SeriesCards,
  LandingBox,
  LandingNone,
  type RecentRow
} from '@renderer/components/Landing'
import { Segmented } from '@renderer/components/Segmented'
import { useAcademicYear } from '@renderer/state/use-academic-year'
import { recentAndUpcoming, seriesLine, seriesSummaries } from '../shared/landing'
import { meetingsInYear } from '../shared/hours'
import { mine, openTodos } from '../shared/open-todos'
import { MODE_LABELS, initialsFor, isUpcoming } from '../shared/query'
import { durationMinutes, formatDate, formatDuration, formatShortDate } from '../shared/time'
import type { MeetingIndexRow } from '../shared/types'
import { MeetingsHours } from './MeetingsHours'
import { NewMeetingButton } from './NewMeetingButton'
import { OpenTodos } from './OpenTodos'
import { meetingRoute, meetingsListRoute, seriesRoute, todayIso } from './meetings-paths'
import { useMeetingsList } from './useMeetingsList'

type Whose = 'everyone' | 'mine'

/** What to say at the right of a "recent and upcoming" row. */
function noteFor(row: MeetingIndexRow, today: string): string {
  if (isUpcoming(row, today)) {
    const topics =
      row.topicCount > 0
        ? `${row.topicCount} ${row.topicCount === 1 ? 'topic' : 'topics'} ready`
        : ''
    return [row.start ?? 'No time yet', topics].filter(Boolean).join(' · ')
  }
  const minutes = durationMinutes(row.start, row.end)
  return [minutes === null ? '' : formatDuration(minutes), row.mode ? MODE_LABELS[row.mode] : '']
    .filter(Boolean)
    .join(' · ')
}

/** The Meetings landing page: open TODOs, the series, and the recent and upcoming meetings. */
export function MeetingsLanding(): React.JSX.Element {
  const { rows, people } = useMeetingsList()
  const [whose, setWhose] = useState<Whose>('everyone')
  const today = todayIso()

  const me = people.find((p) => p.me)
  const all = rows ?? []
  const open = openTodos(all)
  const shown = whose === 'mine' && me ? mine(open, me.initials) : open
  const { upcoming, recent } = recentAndUpcoming(all, today)
  const { year, years, setYear } = useAcademicYear(
    all.map((r) => r.date),
    today
  )
  const summaries = seriesSummaries(meetingsInYear(all, year), today)

  const recentRows: RecentRow[] = [...[...upcoming].reverse(), ...recent].map((row) => ({
    key: row.id,
    to: meetingRoute(row.id),
    date: row.date ? formatDate(row.date) : 'No date yet',
    badge: isUpcoming(row, today) ? (row.date ? 'Upcoming' : 'Planned') : undefined,
    title: row.series,
    people: row.attendees.map((name) => ({ name, initials: initialsFor(name, people) })),
    note: noteFor(row, today)
  }))

  return (
    <LandingPage>
      <LandingHeader
        backTo="/research"
        backLabel="Research"
        title="Meetings"
        actions={
          <>
            <AllLink to={meetingsListRoute}>All meetings</AllLink>
            <NewMeetingButton />
          </>
        }
      />

      {rows === null ? null : (
        <>
          <LandingSection
            id="open-todos"
            label={`Before next meeting · ${shown.length} open`}
            aside={
              me && (
                <Segmented<Whose>
                  label="Whose TODOs"
                  value={whose}
                  options={[
                    { value: 'everyone', label: 'Everyone' },
                    { value: 'mine', label: `Mine (${me.initials})` }
                  ]}
                  onChange={setWhose}
                />
              )
            }
          >
            <LandingBox>
              {shown.length > 0 ? (
                <OpenTodos todos={shown} people={people} />
              ) : (
                <LandingNone>
                  {whose === 'mine'
                    ? 'Nothing open for you.'
                    : 'Nothing open. You are all caught up.'}
                </LandingNone>
              )}
            </LandingBox>
            <LandingHint>
              Picked up from the TODOs you write in your notes. To tick one off, open the next
              meeting of that series: it lists them under “Previous TODOs”.
            </LandingHint>
          </LandingSection>

          <LandingSection
            id="year"
            label="Academic year"
            aside={<AcademicYearSelect year={year} years={years} onChange={setYear} />}
          >
            <MeetingsHours rows={all} year={year} today={today} />
            <SeriesCards
              cards={summaries.map((s) => ({
                key: s.series,
                to: seriesRoute(s.series, year),
                title: s.series,
                line: seriesLine(s, formatShortDate)
              }))}
            />
          </LandingSection>

          <LandingSection
            id="recent"
            label="Recent and upcoming"
            aside={
              <SeeAllLink to={meetingsListRoute}>
                See all meetings
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </SeeAllLink>
            }
          >
            {recentRows.length === 0 ? (
              <EmptyState
                heading="No meetings yet"
                message="Create a meeting to start keeping notes."
              />
            ) : (
              <RecentList rows={recentRows} />
            )}
          </LandingSection>
        </>
      )}
    </LandingPage>
  )
}
