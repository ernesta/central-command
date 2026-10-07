import { useState } from 'react'
import { TimeInput } from '@renderer/components/TimeInput'
import { endFollowingStart } from '@renderer/components/time-input'
import {
  tracksSkills,
  type MeetingMeta,
  type MeetingMode,
  type MeetingWorkspace,
  type Person
} from '../shared/types'
import { isValidDate, type MetaPatch } from '../shared/front-matter'
import { durationMinutes, formatDuration } from '../shared/time'
import { Segmented } from '@renderer/components/Segmented'
import { ComboField } from '@renderer/components/ComboField'
import { SkillsField } from '@renderer/components/SkillsField'
import { orderNames } from '@shared/people'
import { PeopleField } from '@renderer/components/PeopleField'
import { MeetingTask } from './MeetingTask'
import styles from './MetaFields.module.css'

interface MetaFieldsProps {
  workspace: MeetingWorkspace
  /** Series to pick from; any other can be typed. */
  seriesSuggestions: string[]
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
  workspace,
  seriesSuggestions,
  meta,
  people,
  onChange,
  onAddPerson
}: MetaFieldsProps): React.JSX.Element {
  // Typing a new series would rename the file at every keystroke, so the text is kept here and the meeting
  // gets it when a listed series is chosen or typed in full, or when the field is left.
  const [draft, setDraft] = useState<string | null>(null)
  const commitSeries = (text: string): void => {
    const series = text.trim()
    setDraft(null)
    if (series && series !== meta.series) onChange({ series })
  }
  const duration = durationMinutes(meta.start, meta.end)

  const time = (
    key: 'start' | 'end'
  ): { value: string; onChange: (time: string | null) => void } => ({
    value: meta[key] ?? '',
    onChange: (time) =>
      onChange(
        key === 'start'
          ? { start: time, end: endFollowingStart(meta.start, time, meta.end) }
          : { end: time }
      )
  })

  return (
    <div className={styles.meta}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-series">
          Series
        </label>
        <ComboField
          id="meeting-series"
          label="Series"
          placeholder="For example Supervision"
          options={seriesSuggestions}
          value={draft ?? meta.series}
          onChange={(text) => {
            if (seriesSuggestions.includes(text)) commitSeries(text)
            else setDraft(text)
          }}
          onBlur={() => commitSeries(draft ?? meta.series)}
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
            // Clearing the date makes the meeting planned (no date yet); a half-typed date is ignored, so the
            // file only ever gets a real date.
            if (event.target.value === '') onChange({ date: '' })
            else if (isValidDate(event.target.value)) onChange({ date: event.target.value })
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-start">
          Start
        </label>
        <TimeInput id="meeting-start" aria-label="Start time" {...time('start')} />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="meeting-end">
          End
        </label>
        <TimeInput id="meeting-end" aria-label="End time" {...time('end')} />
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
        <span className={styles.label}>Task</span>
        <MeetingTask
          workspace={workspace}
          series={meta.series}
          task={meta.task}
          onChange={(task) => onChange({ task })}
        />
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
        <PeopleField
          label="Attendees"
          noun="attendee"
          names={orderNames(people, meta.attendees)}
          people={people}
          onChange={(attendees) => onChange({ attendees: orderNames(people, attendees) })}
          onAddPerson={onAddPerson}
        />
      </div>
      {tracksSkills(workspace) && (
        <div className={styles.field}>
          <span className={styles.label}>Skills</span>
          <SkillsField skills={meta.skills} onChange={(skills) => onChange({ skills })} />
        </div>
      )}
    </div>
  )
}
