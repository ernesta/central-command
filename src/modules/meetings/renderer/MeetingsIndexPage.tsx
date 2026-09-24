import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { Notice } from '@renderer/components/Notice'
import { meetingHeading } from '../shared/time'
import { SERIES, type MeetingIndexRow } from '../shared/types'
import { meetingRoute, todayIso } from './meetings-paths'
import styles from './MeetingsIndexPage.module.css'

/**
 * A stand-in for the meetings list (built in the next stage): a way to create a meeting and reach
 * the ones that exist. It is replaced by the real list and landing page.
 */
export function MeetingsIndexPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [rows, setRows] = useState<MeetingIndexRow[] | null>(null)
  const [series, setSeries] = useState<string>(SERIES[0])
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.meetings.list('research').then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const create = async (): Promise<void> => {
    setError(null)
    try {
      const file = await window.api.meetings.create({ workspace: 'research', series, date })
      void navigate(meetingRoute(file.ref.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Meetings</h1>
      <p className={styles.note}>The full list and landing page are coming next.</p>
      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      <div className={styles.create}>
        <Select
          label="Series"
          value={series}
          options={SERIES.map((s) => ({ value: s as string, label: s }))}
          onChange={setSeries}
        />
        <input
          type="date"
          aria-label="Date"
          className={styles.date}
          value={date}
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />
        <Button variant="primary" onClick={() => void create()}>
          New meeting
        </Button>
      </div>
      {rows && rows.length > 0 && (
        <ul className={styles.list} aria-label="Meetings">
          {rows.map((row) => (
            <li key={row.id}>
              <Link className={styles.link} to={meetingRoute(row.id)}>
                {meetingHeading(row.series, row.date)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
