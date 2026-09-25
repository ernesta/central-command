import { ArrowRight, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  LandingHeader,
  LandingPage,
  LandingSection,
  RecentList,
  SeeAllLink,
  SeriesCards,
  type RecentRow,
  type SeriesCard
} from '@renderer/components/Landing'
import { formatDate, formatShortDate } from '@shared/time'
import { isoDate } from '../shared/dates'
import { groupLabel, landingGroups } from '../shared/groups'
import { MAX_PINNED, pinnedNotes } from '../shared/pinning'
import { displayTitle, noteCount, recentNotes } from '../shared/query'
import { NewNoteButton } from './NewNoteButton'
import { groupRoute, noteRoute, notesListRoute, ungroupedRoute } from './notes-paths'
import { useNotesList } from './useNotesList'
import styles from './NotesLanding.module.css'

/** The Notes landing page: pinned notes, the groups, and the notes edited most recently. */
export function NotesLanding(): React.JSX.Element {
  const rows = useNotesList()
  const [showAll, setShowAll] = useState(false)
  const all = rows ?? []
  const pinned = pinnedNotes(all)
  const { cards, more } = landingGroups(all)
  const groupCount = cards.filter((c) => c.kind === 'group').length + more.length

  const pinnedCards: SeriesCard[] = pinned.map((row) => ({
    key: row.id,
    to: noteRoute(row.id),
    title: displayTitle(row),
    line: [groupLabel(row.group, row.subgroup), `edited ${formatShortDate(isoDate(row.edited))}`]
      .filter(Boolean)
      .join(' · '),
    pinned: true
  }))

  const groupCards: SeriesCard[] = cards.map((card) =>
    card.kind === 'ungrouped'
      ? {
          key: '\u0000ungrouped',
          to: ungroupedRoute,
          title: 'Ungrouped',
          line: `${noteCount(card.count)} · last ${formatShortDate(isoDate(card.edited))}`,
          dashed: true
        }
      : {
          key: card.group.name,
          to: groupRoute(card.group.name),
          title: card.group.name,
          line: `${noteCount(card.group.count)} · last ${formatShortDate(isoDate(card.group.edited))}`,
          extra: card.group.subgroups.map((s) => s.name).join(', ') || undefined
        }
  )

  const recentRows: RecentRow[] = recentNotes(all).map((row) => ({
    key: row.id,
    to: noteRoute(row.id),
    date: formatDate(isoDate(row.edited)),
    title: displayTitle(row),
    people: [],
    note: groupLabel(row.group, row.subgroup) || 'Ungrouped'
  }))

  return (
    <LandingPage>
      <LandingHeader
        backTo="/research"
        backLabel="Research"
        title="Notes"
        actions={<NewNoteButton />}
      />

      {rows === null ? null : (
        <>
          <LandingSection id="pinned" label={`Pinned · ${pinned.length} of ${MAX_PINNED}`}>
            {pinnedCards.length === 0 ? (
              <p className={styles.hint}>Pin a note from its own page.</p>
            ) : (
              <SeriesCards cards={pinnedCards} />
            )}
          </LandingSection>

          {groupCards.length > 0 && (
            <LandingSection
              id="groups"
              label={`Groups · ${groupCount}`}
              aside={
                more.length > 0 ? (
                  <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={showAll}
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? 'Show fewer' : `Show all ${groupCount}`}
                    <ChevronDown
                      size={14}
                      strokeWidth={1.75}
                      className={showAll ? styles.open : undefined}
                      aria-hidden
                    />
                  </button>
                ) : undefined
              }
            >
              <SeriesCards cards={groupCards} />
              {showAll && more.length > 0 && (
                <ul className={styles.more} aria-label="More groups">
                  {more.map((g) => (
                    <li key={g.name}>
                      <Link className={styles.chip} to={groupRoute(g.name)}>
                        {g.name}
                        <b>{g.count}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </LandingSection>
          )}

          <LandingSection
            id="recent"
            label="Recent"
            aside={
              <SeeAllLink to={notesListRoute}>
                See all notes
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </SeeAllLink>
            }
          >
            {recentRows.length === 0 ? (
              <EmptyState heading="No notes yet" message="Create a note to start." />
            ) : (
              <RecentList rows={recentRows} />
            )}
          </LandingSection>
        </>
      )}
    </LandingPage>
  )
}
