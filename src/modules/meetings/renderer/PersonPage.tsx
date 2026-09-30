import { MentionedIn } from '@renderer/entities/MentionedIn'
import { useParams } from 'react-router'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  LandingHeader,
  LandingPage,
  LandingSection,
  RecentList,
  type RecentRow
} from '@renderer/components/Landing'
import { formatDate } from '@shared/time'
import { entryRoute } from '@modules/training/renderer/training-paths'
import { meetingRoute, peopleRoute } from './meetings-paths'
import { PersonLinks } from './PersonLinks'
import { usePersonProfile } from './usePersonProfile'
import styles from './PersonPage.module.css'

/**
 * One person's own page: their meetings and trainings (newest first), when you last met and the next
 * meeting, and their links.
 */
export function PersonPage(): React.JSX.Element {
  const { name = '' } = useParams()
  const { profile, loading, refresh } = usePersonProfile(decodeURIComponent(name))
  const { person, meetings, trainings, lastMet, nextMeeting } = profile

  if (!loading && !person) {
    return (
      <LandingPage>
        <LandingHeader
          backTo={peopleRoute}
          backLabel="People"
          title="Person not found"
          actions={null}
        />
        <EmptyState
          heading="Person not found"
          message={`There is nobody called “${decodeURIComponent(name)}” in your people list.`}
        />
      </LandingPage>
    )
  }

  const meetingRows: RecentRow[] = meetings.map((m) => ({
    key: `${m.workspace}/${m.id}`,
    to: meetingRoute(m.workspace, m.id),
    date: m.date ? formatDate(m.date) : 'No date yet',
    title: m.series || 'Meeting',
    people: [],
    note: m.summary || `${m.topicCount} ${m.topicCount === 1 ? 'topic' : 'topics'}`
  }))

  const trainingRows: RecentRow[] = trainings.map((t) => ({
    key: t.id,
    to: entryRoute(t.id),
    date: t.date ? formatDate(t.date) : 'No date yet',
    title: t.title || 'Untitled',
    people: [],
    note: t.series || ''
  }))

  return (
    <LandingPage>
      <LandingHeader
        backTo={peopleRoute}
        backLabel="People"
        title={person ? (person.me ? `${person.name} (you)` : person.name) : ''}
        actions={null}
      />

      <div className={styles.summary}>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Last met</p>
          <p className={styles.statValue}>{lastMet ? formatDate(lastMet.date) : 'Not yet'}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Next meeting</p>
          <p className={styles.statValue}>
            {nextMeeting ? formatDate(nextMeeting.date) : 'None planned'}
          </p>
        </div>
      </div>

      {person && (
        <PersonLinks
          links={person.links ?? []}
          onChange={(links) =>
            void window.api.meetings.people.update(person.name, { links }).then(refresh)
          }
        />
      )}

      <LandingSection id="meetings" label={`Meetings · ${meetings.length}`}>
        {meetingRows.length === 0 ? (
          <p>No meetings together yet.</p>
        ) : (
          <RecentList rows={meetingRows} />
        )}
      </LandingSection>

      {person && <MentionedIn kind="person" entityKey={person.name} />}

      {trainingRows.length > 0 && (
        <LandingSection id="trainings" label={`Trainings · ${trainings.length}`}>
          <RecentList rows={trainingRows} />
        </LandingSection>
      )}
    </LandingPage>
  )
}
