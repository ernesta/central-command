import { ArrowRight } from 'lucide-react'
import { YearSelect } from '@renderer/components/YearSelect'
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
import { useYear } from '@renderer/state/use-year'
import { useSettings } from '@renderer/state/settings-context'
import { formatHours } from '@shared/skills'
import { formatDate, formatDuration } from '@shared/time'
import { initialsFor } from '@modules/meetings/shared/query'
import { meetingHours } from '@modules/meetings/shared/hours'
import {
  entriesInYear,
  entriesInYearOrPlanned,
  isUpcoming,
  meetingsLine,
  recentAndUpcoming,
  entryMinutes,
  seriesSummaries,
  trainingHours,
  type SelfStudy,
  yearHoursTitle
} from '../shared/rules'
import { TRAINING_MODE_LABELS, type TrainingIndexRow } from '../shared/types'
import { NewTrainingButton } from './NewTrainingButton'
import {
  entryRoute,
  seriesRoute,
  todayIso,
  trainingListRoute,
  trainingPlanRoute
} from './training-paths'
import { useSelfStudy } from './useSelfStudy'
import { useTrainingList } from './useTrainingList'

/** What to say at the right of a "recent and upcoming" row. */
function noteFor(row: TrainingIndexRow, today: string, selfStudy: SelfStudy): string {
  if (isUpcoming(row, today)) return row.start ?? 'No time yet'
  const minutes = entryMinutes(row, selfStudy)
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
  const selfStudy = useSelfStudy()
  const { settings } = useSettings()
  const today = todayIso()
  const all = rows ?? []
  const { year, years, setYear } = useYear(
    [...all.map((r) => r.date), ...meetings.map((m) => m.date)],
    today
  )
  const aim = settings.trainingAimHours
  const hours = trainingHours(all, year, today, aim, selfStudy)
  const meetingMinutes = meetingHours(meetings, year, today).minutes
  const { upcoming, recent } = recentAndUpcoming(entriesInYearOrPlanned(all, year, today), today)
  const summaries = seriesSummaries(entriesInYear(all, year), today, selfStudy)

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
    detail: row.series || undefined,
    people: row.leads.map((name) => ({ name, initials: initialsFor(name, people) })),
    note: noteFor(row, today, selfStudy)
  }))

  return (
    <LandingPage>
      <LandingHeader
        backTo="/research"
        backLabel="Research"
        title="Training"
        actions={
          <>
            <AllLink to={`${trainingPlanRoute}?year=${year}`}>Training plan</AllLink>
            <NewTrainingButton />
          </>
        }
      />

      {rows === null ? null : (
        <>
          <LandingSection
            id="year"
            label="Year"
            aside={<YearSelect year={year} years={years} onChange={setYear} />}
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
              <SeeAllLink to={`${trainingListRoute}?year=${year}`}>
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
