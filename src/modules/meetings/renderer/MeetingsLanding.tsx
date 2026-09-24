import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@renderer/components/EmptyState'
import { Segmented } from '@renderer/components/Segmented'
import { recentAndUpcoming, seriesLine, seriesSummaries } from '../shared/landing'
import { mine, openTodos } from '../shared/open-todos'
import { MODE_LABELS, initialsFor, isUpcoming } from '../shared/query'
import { durationMinutes, formatDate, formatDuration, formatShortDate } from '../shared/time'
import type { MeetingIndexRow } from '../shared/types'
import { NewMeetingButton } from './NewMeetingButton'
import { OpenTodos } from './OpenTodos'
import { meetingRoute, meetingsListRoute, seriesRoute, todayIso } from './meetings-paths'
import { useMeetingsList } from './useMeetingsList'
import styles from './MeetingsLanding.module.css'

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
  const summaries = seriesSummaries(all, today)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Meetings</h1>
        <div className={styles.actions}>
          <Link className={styles.allLink} to={meetingsListRoute}>
            All meetings
          </Link>
          <NewMeetingButton />
        </div>
      </header>

      {rows === null ? null : (
        <>
          <section className={styles.section} aria-labelledby="open-todos">
            <div className={styles.sectionHead}>
              <h2 id="open-todos" className={styles.label}>
                Before next meeting · {shown.length} open
              </h2>
              {me && (
                <Segmented<Whose>
                  label="Whose TODOs"
                  value={whose}
                  options={[
                    { value: 'everyone', label: 'Everyone' },
                    { value: 'mine', label: `Mine (${me.initials})` }
                  ]}
                  onChange={setWhose}
                />
              )}
            </div>
            <div className={styles.box}>
              {shown.length > 0 ? (
                <OpenTodos todos={shown} people={people} />
              ) : (
                <p className={styles.none}>
                  {whose === 'mine'
                    ? 'Nothing open for you.'
                    : 'Nothing open. You are all caught up.'}
                </p>
              )}
            </div>
            <p className={styles.hint}>
              Picked up from the TODOs you write in your notes. To tick one off, open the next
              meeting of that series: it lists them under “Previous TODOs”.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="series">
            <h2 id="series" className={styles.label}>
              Series
            </h2>
            <div className={styles.cards}>
              {summaries.map((s) => (
                <div key={s.series} className={styles.card}>
                  <h3 className={styles.cardTitle}>
                    <Link className={styles.cardLink} to={seriesRoute(s.series)}>
                      {s.series}
                    </Link>
                  </h3>
                  <p className={styles.line}>{seriesLine(s, formatShortDate)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="recent">
            <div className={styles.sectionHead}>
              <h2 id="recent" className={styles.label}>
                Recent and upcoming
              </h2>
              <Link className={styles.link} to={meetingsListRoute}>
                See all meetings
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </Link>
            </div>
            {upcoming.length + recent.length === 0 ? (
              <EmptyState
                heading="No meetings yet"
                message="Create a meeting to start keeping notes."
              />
            ) : (
              <ul className={styles.box + ' ' + styles.recentList}>
                {[...[...upcoming].reverse(), ...recent].map((row) => (
                  <li key={row.id}>
                    <Link className={styles.recent} to={meetingRoute(row.id)}>
                      <span className={styles.date}>
                        {row.date ? formatDate(row.date) : 'No date'}
                      </span>
                      <span>
                        {row.series}
                        {isUpcoming(row, today) && (
                          <span className={styles.upcoming}>Upcoming</span>
                        )}
                      </span>
                      <span className={styles.chips}>
                        {row.attendees.slice(0, 3).map((name) => (
                          <span key={name} className={styles.chip} title={name}>
                            {initialsFor(name, people)}
                          </span>
                        ))}
                        {row.attendees.length > 3 && (
                          <span className={styles.more}>+{row.attendees.length - 3}</span>
                        )}
                      </span>
                      <span className={styles.note}>{noteFor(row, today)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
