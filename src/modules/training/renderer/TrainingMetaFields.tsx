import { Segmented } from '@renderer/components/Segmented'
import { PeopleField } from '@renderer/components/PeopleField'
import { Select } from '@renderer/components/Select'
import { SkillsField } from '@renderer/components/SkillsField'
import type { Person } from '@shared/people'
import { durationMinutes, formatDuration } from '@shared/time'
import { isValidDate, normaliseTime, type TrainingPatch } from '../shared/front-matter'
import {
  TRAINING_MODE_LABELS,
  TRAINING_MODES,
  TRAINING_TYPES,
  type TrainingMeta,
  type TrainingMode
} from '../shared/types'
import styles from './TrainingMetaFields.module.css'

interface TrainingMetaFieldsProps {
  meta: TrainingMeta
  people: Person[]
  /** Series already used, offered as suggestions. */
  seriesSuggestions: string[]
  onChange: (patch: TrainingPatch) => void
  onAddPerson: (name: string) => Promise<Person>
}

const MODE_OPTIONS = TRAINING_MODES.map((value) => ({
  value,
  label: TRAINING_MODE_LABELS[value]
}))

/** The entry's own details above the note: date, times, series, type, format, leads and skills. */
export function TrainingMetaFields({
  meta,
  people,
  seriesSuggestions,
  onChange,
  onAddPerson
}: TrainingMetaFieldsProps): React.JSX.Element {
  const duration = durationMinutes(meta.start, meta.end)
  const knownType = meta.type === null || TRAINING_TYPES.some((t) => t.name === meta.type)
  const typeOptions = [
    { value: '', label: 'No type yet' },
    ...(knownType ? [] : [{ value: meta.type ?? '', label: `${meta.type} (not on the list)` }]),
    ...TRAINING_TYPES.map((t) => ({ value: t.name, label: t.name, group: t.group }))
  ]
  const current = TRAINING_TYPES.find((t) => t.name === meta.type)

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
        <label className={styles.label} htmlFor="training-date">
          Date
        </label>
        <input
          id="training-date"
          type="date"
          className={styles.input}
          value={meta.date}
          onChange={(event) => {
            // Clearing the date makes the entry planned (no date yet); a half-typed date is ignored, so the
            // file only ever gets a real date.
            if (event.target.value === '') onChange({ date: '' })
            else if (isValidDate(event.target.value)) onChange({ date: event.target.value })
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="training-start">
          Start
        </label>
        <input id="training-start" className={styles.input} {...time('start')} />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="training-end">
          End
        </label>
        <input id="training-end" className={styles.input} {...time('end')} />
      </div>
      <div className={styles.field}>
        <span className={styles.label} id="training-duration-label">
          Duration
        </span>
        <output className={styles.calc} aria-labelledby="training-duration-label">
          {duration === null ? '—' : formatDuration(duration)}
        </output>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="training-series">
          Series
        </label>
        <input
          id="training-series"
          className={styles.input}
          list="training-series-options"
          placeholder="None"
          value={meta.series ?? ''}
          onChange={(event) =>
            onChange({ series: event.target.value.replace(/[\r\n]/g, '') || null })
          }
        />
        <datalist id="training-series-options">
          {seriesSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="training-type">
          Type
        </label>
        <Select
          id="training-type"
          label="Type"
          value={meta.type ?? ''}
          options={typeOptions}
          onChange={(type) => onChange({ type: type || null })}
        />
        {current?.description && <span className={styles.hint}>{current.description}</span>}
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Format</span>
        <Segmented<TrainingMode | ''>
          label="Format"
          value={meta.mode ?? ''}
          options={MODE_OPTIONS}
          // Choosing the selected format again clears it.
          onChange={(mode) => onChange({ mode: mode === meta.mode || mode === '' ? null : mode })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="training-institution">
          Institution
        </label>
        <input
          id="training-institution"
          className={styles.input}
          placeholder="For example Royal Holloway"
          value={meta.institution ?? ''}
          onChange={(event) =>
            onChange({ institution: event.target.value.replace(/[\r\n]/g, '') || null })
          }
        />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Leads</span>
        <PeopleField
          label="Leads"
          noun="lead"
          names={meta.leads}
          people={people}
          onChange={(leads) => onChange({ leads })}
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
