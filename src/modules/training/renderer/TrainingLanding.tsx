import { ArrowRight } from 'lucide-react'
import { AcademicYearSelect } from '@renderer/components/AcademicYearSelect'
import { EmptyState } from '@renderer/components/EmptyState'
import { HoursStrip } from '@renderer/components/HoursStrip'
import {
  AllLink,
  LandingHeader,
  LandingPage,
  LandingSection,
  RecentList,
  SeeAllLink,
  SeriesCards,
  type RecentRow
} from '@renderer/components/Landing'
import { useAcademicYear } from '@renderer/state/use-academic-year'
import { useSettings } from '@renderer/state/settings-context'
import { formatHours } from '@shared/skills'
import { durationMinutes, formatDate, formatDuration } from '@shared/time'
import { initialsFor } from '@modules/meetings/shared/query'
import { meetingHours } from '@modules/meetings/shared/hours'
import {
  entriesInYear,
  isUpcoming,
  meetingsLine,
  recentAndUpcoming,
  seriesSummaries,
  trainingHours,
  yearHoursTitle
} from '../shared/rules'
import { TRAINING_MODE_LABELS, TRAINING_SERIES, type TrainingIndexRow } from '../shared/types'
import { NewTrainingButton } from './NewTrainingButton'
import { entryRoute, seriesRoute, todayIso, trainingListRoute } from './training-paths'
import { useTrainingList } from './useTrainingList'

/** What to say at the right of a "recent and upcoming" row. */
function noteFor(row: TrainingIndexRow, today: string): string {
  if (isUpcoming(row, today)) return row.start ?? 'No time yet'
  const minutes = durationMinutes(row.start, row.end)
  return [
    minutes === null ? '' : formatDuration(minutes),
    row.mode ? TRAINING_MODE_LABELS[row.mode] : ''
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The Training landing page: the year's hours, a card per series, and the recent and upcoming entries. */
export function TrainingLanding(): React.JSX.Element {
  const { rows, meetings, people } = useTrainingList()
  const { settings } = useSettings()
  const today = todayIso()
  const all = rows ?? []
  const { year, years, setYear } = useAcademicYear(
    [...all.map((r) => r.date), ...meetings.map((m) => m.date)],
    today
  )
  const aim = settings.trainingAimHours
  const hours = trainingHours(all, year, today, aim)
  const meetingMinutes = meetingHours(meetings, year, today).minutes
  const { upcoming, recent } = recentAndUpcoming(all, today)
  const summaries = seriesSummaries(entriesInYear(all, year), TRAINING_SERIES, today)

  const noteParts = [
    `${hours.entries} ${hours.entries === 1 ? 'entry' : 'entries'}`,
    hours.withoutTimes > 0 ? `${hours.withoutTimes} without times, counted as 0` : ''
  ].filter(Boolean)

  const recentRows: RecentRow[] = [...[...upcoming].reverse(), ...recent].map((row) => ({
    key: row.id,
    to: entryRoute(row.id),
    date: row.date ? formatDate(row.date) : 'No date yet',
    badge: isUpcoming(row, today) ? (row.date ? 'Upcoming' : 'Planned') : undefined,
    title: row.title || 'Untitled',
    people: row.leads.map((name) => ({ name, initials: initialsFor(name, people) })),
    note: noteFor(row, today)
  }))

  return (
    <LandingPage>
      <LandingHeader
        backTo="/research"
        backLabel="Research"
        title="Training"
        actions={
          <>
            <AllLink to={trainingListRoute}>All training</AllLink>
            <NewTrainingButton />
          </>
        }
      />

      {rows === null ? null : (
        <>
          <LandingSection
            id="year"
            label="Academic year"
            aside={<AcademicYearSelect year={year} years={years} onChange={setYear} />}
          >
            <HoursStrip
              title={yearHoursTitle(year)}
              minutes={hours.minutes}
              note={noteParts.join(' · ')}
              aim={{ hours: aim, progress: hours.progress }}
              extra={meetingMinutes > 0 ? meetingsLine(meetingMinutes) : undefined}
              perSkill={hours.perSkill}
            />
            <SeriesCards
              cards={summaries.map((s) => ({
                key: s.series,
                to: seriesRoute(s.series, year),
                title: s.series,
                line:
                  s.count === 0
                    ? 'No entries yet'
                    : `${s.count} ${s.count === 1 ? 'entry' : 'entries'} · ${formatHours(s.minutes)}`
              }))}
            />
          </LandingSection>

          <LandingSection
            id="recent"
            label="Recent and upcoming"
            aside={
              <SeeAllLink to={trainingListRoute}>
                See all training
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </SeeAllLink>
            }
          >
            {recentRows.length === 0 ? (
              <EmptyState heading="No training yet" message="Create an entry to start your log." />
            ) : (
              <RecentList rows={recentRows} />
            )}
          </LandingSection>
        </>
      )}
    </LandingPage>
  )
}
