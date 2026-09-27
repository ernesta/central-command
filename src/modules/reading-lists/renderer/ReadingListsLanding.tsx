import { ArrowRight } from 'lucide-react'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  LandingHeader,
  LandingPage,
  LandingSection,
  RecentList,
  SeeAllLink,
  type RecentRow
} from '@renderer/components/Landing'
import { isoDate } from '@shared/dates'
import { formatDate } from '@shared/time'
import { displayTitle, compareRecent } from '@modules/reading-lists/shared/query'
import { NewListButton } from './NewListButton'
import { readingListRoute, readingListsListRoute } from './reading-lists-paths'
import { useReadingListsList } from './useReadingListsList'

/** The Reading lists landing page: the lists edited most recently, and a link to see them all. */
export function ReadingListsLanding(): React.JSX.Element {
  const rows = useReadingListsList()
  const all = rows ?? []
  const recent = [...all].sort(compareRecent).slice(0, 8)

  const recentRows: RecentRow[] = recent.map((row) => ({
    key: row.id,
    to: readingListRoute(row.id),
    date: formatDate(isoDate(row.edited)),
    title: displayTitle(row),
    people: [],
    note: `${row.sectionCount} ${row.sectionCount === 1 ? 'section' : 'sections'} · ${row.entryCount} ${row.entryCount === 1 ? 'entry' : 'entries'}`
  }))

  return (
    <LandingPage>
      <LandingHeader
        backTo="/research"
        backLabel="Research"
        title="Reading lists"
        actions={<NewListButton />}
      />

      {rows !== null && (
        <LandingSection
          id="recent"
          label="Recent"
          aside={
            all.length > recent.length ? (
              <SeeAllLink to={readingListsListRoute}>
                See all lists
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </SeeAllLink>
            ) : undefined
          }
        >
          {recentRows.length === 0 ? (
            <EmptyState heading="No reading lists yet" message="Create a list to start." />
          ) : (
            <RecentList rows={recentRows} />
          )}
        </LandingSection>
      )}
    </LandingPage>
  )
}
