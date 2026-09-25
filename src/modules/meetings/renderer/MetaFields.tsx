import { SERIES, type MeetingMeta, type MeetingMode, type Person } from '../shared/types'
import { isValidDate, normaliseTime, type MetaPatch } from '../shared/front-matter'
import { durationMinutes, formatDuration } from '../shared/time'
import { Segmented } from '@renderer/components/Segmented'
import { Select } from '@renderer/components/Select'
import { SkillsField } from '@renderer/components/SkillsField'
import { AttendeesField } from './AttendeesField'
import styles from './MetaFields.module.css'

interface MetaFieldsProps {
  meta: MeetingMeta
  people: Person[]
  onChange: (patch: MetaPatch) => void
  onAddPerson: (name: string) => Promise<Person>
}

const MODE_OPTIONS = [
  { value: 'in-person', label: 'In person' },
  { value: 'online', label: 'Online' }
] as const

/** The meeting's own details above the note: series, date, times, type and attendees. */
export function MetaFields({
  meta,
  people,
  onChange,
  onAddPerson
}: MetaFieldsProps): React.JSX.Element {
  const known = (SERIES as readonly string[]).includes(meta.series)
  const seriesOptions = [
    ...SERIES.map((s) => ({ value: s as string, label: s })),
    ...(known || !meta.series ? [] : [{ value: meta.series, label: meta.series }])
  ]
  const duration = durationMinutes(meta.start, meta.end)

  const time = (
    key: 'start' | 'end'
  ): {
    type: 'time'
    value: string
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  } => ({
    type: 'time' as const,
    value: meta[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value
      if (raw === '') onChange({ [key]: null })
      else {
        const t = normaliseTime(raw)
        if (t) onChange({ [key]: t })
      }
    }
  })

  return (
    <div className={styles.meta}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-series">
          Series
        </label>
        <Select
          id="meeting-series"
          label="Series"
          value={meta.series}
          options={seriesOptions}
          onChange={(series) => onChange({ series })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-date">
          Date
        </label>
        <input
          id="meeting-date"
          type="date"
          className={styles.input}
          value={meta.date}
          onChange={(event) => {
            // A cleared or half-typed date is ignored; the file only ever gets a real date.
            if (isValidDate(event.target.value)) onChange({ date: event.target.value })
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-start">
          Start
        </label>
        <input id="meeting-start" className={styles.input} {...time('start')} />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-end">
          End
        </label>
        <input id="meeting-end" className={styles.input} {...time('end')} />
      </div>
      <div className={styles.field}>
        <span className={styles.label} id="meeting-duration-label">
          Duration
        </span>
        <output className={styles.calc} aria-labelledby="meeting-duration-label">
          {duration === null ? '—' : formatDuration(duration)}
        </output>
      </div>
      <div className={styles.field}>
        <span className={styles.label} id="meeting-type-label">
          Type
        </span>
        <Segmented<MeetingMode | ''>
          label="Type"
          value={meta.mode ?? ''}
          options={MODE_OPTIONS}
          // Choosing the selected type again clears it.
          onChange={(mode) => onChange({ mode: mode === meta.mode || mode === '' ? null : mode })}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Attendees</span>
        <AttendeesField
          attendees={meta.attendees}
          people={people}
          onChange={(attendees) => onChange({ attendees })}
          onAddPerson={onAddPerson}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Skills</span>
        <SkillsField skills={meta.skills} onChange={(skills) => onChange({ skills })} />
      </div>
    </div>
  )
}
