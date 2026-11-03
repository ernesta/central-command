import { useToday } from '@renderer/state/use-today'
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
import { usePeriod } from '@renderer/state/use-period'
import { useSettings } from '@renderer/state/settings-context'
import { formatHours } from '@shared/skills'
import { ALL_YEARS } from '@shared/year-scope'
import { formatDate } from '@shared/time'
import { initialsFor } from '@modules/meetings/shared/query'
import {
  entriesInYear,
  entriesInYearOrPlanned,
  isNow,
  isUpcoming,
  recentAndUpcoming,
  entryParts,
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
  clockNow,
  trainingListRoute,
  trainingPlanRoute,
  useTrainingWorkspace
} from './training-paths'
import { trainingLabel } from '../shared/training-entries'
import { rowTimeLine } from '../shared/row-time'
import { useSelfStudy } from './useSelfStudy'
import { useTrainingList } from './useTrainingList'

/** What to say at the right of a "recent and upcoming" row: the same parts for an upcoming and a past one. */
function noteFor(row: TrainingIndexRow, selfStudy: SelfStudy): string {
  const parts = entryParts(row, selfStudy)
  return rowTimeLine(
    row,
    row.mode ? TRAINING_MODE_LABELS[row.mode] : null,
    parts && parts.training,
    parts?.selfStudy
  )
}

/** The Training landing page: the year's hours, a card per series, and the recent and upcoming entries. */
export function TrainingLanding(): React.JSX.Element {
  const workspace = useTrainingWorkspace()
  // Life keeps a plain log: no yearly aim, no hours of meetings, no skills and no plan.
  const research = workspace === 'research'
  const { rows, meetings, people } = useTrainingList(workspace)
  const selfStudy = useSelfStudy()
  const { settings } = useSettings()
  const today = useToday()
  const now = clockNow()
  const all = rows ?? []
  // Research follows its one academic year filter (every year under All); Life keeps a selector of its own.
  const period = usePeriod(
    workspace,
    [...all.map((r) => r.date), ...meetings.map((m) => m.date)],
    today
  )
  const { year, years, setYear } = period
  const span = period.all ? null : year
  // A link carries the scope: under All, `all`, not the year the page would otherwise have picked.
  const linkYear = period.all ? ALL_YEARS : year
  const aim = settings.trainingAimHours
  const hours = trainingHours(all, span, today, aim, selfStudy, now)
  const { upcoming, recent } = recentAndUpcoming(
    entriesInYearOrPlanned(all, span, today),
    today,
    now
  )
  const summaries = seriesSummaries(entriesInYear(all, span), today, selfStudy, now)

  const noteParts = [`${hours.entries} done`]

  const recentRows: RecentRow[] = [...[...upcoming].reverse(), ...recent].map((row) => ({
    key: row.id,
    to: entryRoute(row.id, workspace),
    date: row.date ? formatDate(row.date) : 'No date',
    badge: isNow(row, today, now) ? 'Now' : isUpcoming(row, today, now) ? 'Upcoming' : undefined,
    title: trainingLabel(row.series, row.title || 'Untitled'),
    people: row.leads.map((name) => ({ name, initials: initialsFor(name, people) })),
    note: noteFor(row, selfStudy)
  }))

  return (
    <LandingPage>
      <LandingHeader
        title="Training"
        actions={
          <>
            {research && (
              <AllLink to={`${trainingPlanRoute}?year=${linkYear}`}>Training plan</AllLink>
            )}
            <NewTrainingButton workspace={workspace} />
          </>
        }
      />

      {rows === null ? null : (
        <>
          <LandingSection
            id="year"
            label="Year"
            labelHidden
            aside={!research && <YearSelect year={year} years={years} onChange={setYear} />}
          >
            <HoursStrip
              title={yearHoursTitle(span)}
              minutes={hours.minutes}
              note={noteParts.join(' · ')}
              // The yearly aim means nothing across years: no aim under All years.
              aim={research && !period.all ? { hours: aim, progress: hours.progress } : undefined}
              perSkill={research ? hours.perSkill : []}
            />
            <SeriesCards
              cards={summaries.map((s) => ({
                key: s.series,
                to: seriesRoute(s.series, linkYear, workspace),
                title: s.series,
                line:
                  s.count === 0 && s.upcoming === 0
                    ? 'No entries yet'
                    : [
                        s.count > 0 ? `${s.count} done` : '',
                        s.upcoming > 0 ? `${s.upcoming} upcoming` : '',
                        s.count > 0
                          ? `${formatHours(s.training)}${s.selfStudy > 0 ? ` + ${formatHours(s.selfStudy)} self-study` : ''}`
                          : ''
                      ]
                        .filter(Boolean)
                        .join(' · ')
              }))}
            />
          </LandingSection>

          <LandingSection
            id="recent"
            label="Recent and upcoming"
            aside={
              <SeeAllLink window to={`${trainingListRoute(workspace)}?year=${linkYear}`}>
                See all training
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </SeeAllLink>
            }
          >
            {recentRows.length === 0 ? (
              <EmptyState
                heading="Nothing in the last or next 7 days"
                message="See all training for the rest."
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
