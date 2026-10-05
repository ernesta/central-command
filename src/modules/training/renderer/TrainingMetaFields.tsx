import { TimeInput } from '@renderer/components/TimeInput'
import { Segmented } from '@renderer/components/Segmented'
import { PeopleField } from '@renderer/components/PeopleField'
import { ComboField } from '@renderer/components/ComboField'
import { DescribedSelect } from '@renderer/components/DescribedSelect'
import { SkillsField } from '@renderer/components/SkillsField'
import { orderNames, type Person } from '@shared/people'
import { durationMinutes, formatDuration } from '@shared/time'
import { isValidDate, type TrainingPatch } from '../shared/front-matter'
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
  /** Series and institutions already used, offered in the drop-downs. */
  seriesSuggestions: string[]
  institutionSuggestions: string[]
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
  institutionSuggestions,
  onChange,
  onAddPerson
}: TrainingMetaFieldsProps): React.JSX.Element {
  const duration = durationMinutes(meta.start, meta.end)
  const knownType = meta.type === null || TRAINING_TYPES.some((t) => t.name === meta.type)
  const typeOptions = [
    { value: '', label: 'No type yet' },
    ...(knownType ? [] : [{ value: meta.type ?? '', label: `${meta.type} (not on the list)` }]),
    ...TRAINING_TYPES.map((t) => ({
      value: t.name,
      label: t.name,
      group: t.group,
      description: t.description
    }))
  ]

  const time = (
    key: 'start' | 'end'
  ): { value: string; onChange: (time: string | null) => void } => ({
    value: meta[key] ?? '',
    onChange: (time) => onChange({ [key]: time })
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
        <TimeInput id="training-start" aria-label="Start time" {...time('start')} />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="training-end">
          End
        </label>
        <TimeInput id="training-end" aria-label="End time" {...time('end')} />
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
        <ComboField
          id="training-series"
          label="Series"
          placeholder="None"
          options={seriesSuggestions}
          value={meta.series ?? ''}
          onChange={(series) => onChange({ series: series || null })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="training-type">
          Type
        </label>
        <DescribedSelect
          id="training-type"
          label="Type"
          value={meta.type ?? ''}
          options={typeOptions}
          onChange={(type) => onChange({ type: type || null })}
        />
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
        <ComboField
          id="training-institution"
          label="Institution"
          placeholder="For example Royal Holloway"
          options={institutionSuggestions}
          value={meta.institution ?? ''}
          onChange={(institution) => onChange({ institution: institution || null })}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Leads</span>
        <PeopleField
          label="Leads"
          noun="lead"
          names={orderNames(people, meta.leads)}
          people={people}
          onChange={(leads) => onChange({ leads: orderNames(people, leads) })}
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
