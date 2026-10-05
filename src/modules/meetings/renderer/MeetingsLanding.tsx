import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { YearSelect } from '@renderer/components/YearSelect'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  LandingHeader,
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
import { useYear } from '@renderer/state/use-year'
import { recentAndUpcoming, seriesLine, seriesSummaries } from '../shared/landing'
import { meetingsInYear, meetingsInYearOrPlanned } from '../shared/hours'
import { mine, openTodos } from '../shared/open-todos'
import { MODE_LABELS, initialsFor, isUpcoming } from '../shared/query'
import { durationMinutes, formatDate, formatDuration, formatShortDate } from '../shared/time'
import { fixedSeries, tracksSkills, type MeetingIndexRow } from '../shared/types'
import { MeetingsHours } from './MeetingsHours'
import { NewMeetingButton } from './NewMeetingButton'
import { OpenTodos } from './OpenTodos'
import {
  meetingRoute,
  meetingsListRoute,
  seriesRoute,
  todayIso,
  useMeetingsWorkspace
} from './meetings-paths'
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
  const workspace = useMeetingsWorkspace()
  const { rows, people } = useMeetingsList(workspace)
  const [whose, setWhose] = useState<Whose>('everyone')
  const today = todayIso()

  const me = people.find((p) => p.me)
  const all = rows ?? []
  const open = openTodos(all)
  const shown = whose === 'mine' && me ? mine(open, me.initials) : open
  const { year, years, setYear } = useYear(
    all.map((r) => r.date),
    today
  )
  const { upcoming, recent } = recentAndUpcoming(meetingsInYearOrPlanned(all, year, today), today)
  const summaries = seriesSummaries(meetingsInYear(all, year), today, fixedSeries(workspace))

  const recentRows: RecentRow[] = [...[...upcoming].reverse(), ...recent].map((row) => ({
    key: row.id,
    to: meetingRoute(workspace, row.id),
    date: row.date ? formatDate(row.date) : 'No date yet',
    badge: isUpcoming(row, today) ? (row.date ? 'Upcoming' : 'Planned') : undefined,
    title: row.series,
    people: row.attendees.map((name) => ({ name, initials: initialsFor(name, people) })),
    note: noteFor(row, today)
  }))

  return (
    <LandingPage>
      <LandingHeader
        backTo={workspace === 'research' ? '/research' : '/work'}
        backLabel={workspace === 'research' ? 'Research' : 'Work'}
        title="Meetings"
        actions={<NewMeetingButton />}
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
                <OpenTodos todos={shown} people={people} workspace={workspace} />
              ) : (
                <LandingNone>
                  {whose === 'mine'
                    ? 'Nothing open for you.'
                    : 'Nothing open. You are all caught up.'}
                </LandingNone>
              )}
            </LandingBox>
          </LandingSection>

          <LandingSection
            id="year"
            label="Year"
            aside={<YearSelect year={year} years={years} onChange={setYear} />}
          >
            <MeetingsHours
              rows={all}
              year={year}
              today={today}
              showSkills={tracksSkills(workspace)}
            />
            <SeriesCards
              cards={summaries.map((s) => ({
                key: s.series,
                to: seriesRoute(workspace, s.series, year),
                title: s.series,
                line: seriesLine(s, formatShortDate)
              }))}
            />
          </LandingSection>

          <LandingSection
            id="recent"
            label="Recent and upcoming"
            aside={
              <SeeAllLink to={`${meetingsListRoute(workspace)}?year=${year}`}>
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
