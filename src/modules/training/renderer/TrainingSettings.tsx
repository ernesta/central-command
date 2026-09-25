import { useState } from 'react'
import { Input } from '@renderer/components/Input'
import { PathField } from '@renderer/shell/PathField'
import { useSettings } from '@renderer/state/settings-context'
import styles from './TrainingSettings.module.css'

/** Training's settings: the folder holding training files and the yearly aim in hours. */
export function TrainingSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(settings.trainingAimHours)

  const commitAim = (): void => {
    if (draft === null) return
    const hours = Number(draft)
    setDraft(null)
    if (
      Number.isFinite(hours) &&
      hours > 0 &&
      hours <= 5000 &&
      hours !== settings.trainingAimHours
    ) {
      void update({ trainingAimHours: hours })
    }
  }

  return (
    <section className={styles.section} aria-labelledby="training-settings">
      <h2 id="training-settings" className={styles.heading}>
        Training
      </h2>
      <PathField
        label="Trainings folder"
        help="The folder holding your training files (slides, readings). Entries link to folders inside it; the app only lists and opens them and never changes them."
        kind="folder"
        placeholder="/path/to/Trainings"
        value={settings.trainingsFolder}
        onCommit={(trainingsFolder) => void update({ trainingsFolder })}
      />
      <div className={styles.field}>
        <label htmlFor="training-aim" className={styles.label}>
          Yearly training aim (hours)
        </label>
        <p className={styles.help}>
          Training shows the hours you have done towards this each academic year.
        </p>
        <Input
          id="training-aim"
          className={styles.aim}
          inputMode="numeric"
          value={shown}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitAim}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
      </div>
    </section>
  )
}
