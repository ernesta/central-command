import { formatHours } from '@shared/skills'
import styles from './HoursStrip.module.css'

interface HoursStripProps {
  /** What the total is of, for example "Hours of meetings, 2025–26". */
  title: string
  minutes: number
  /** One quiet line under the total, for example "12 meetings · 2 without times". */
  note?: string
  perSkill: readonly { skill: string; minutes: number }[]
}

/** The total hours and the hours per skill, largest first. Shared by Meetings and Training. */
export function HoursStrip({ title, minutes, note, perSkill }: HoursStripProps): React.JSX.Element {
  return (
    <section className={styles.strip} aria-label={title}>
      <div className={styles.total}>
        <span className={styles.value}>{formatHours(minutes)}</span>
        <span className={styles.title}>{title}</span>
        {note && <span className={styles.note}>{note}</span>}
      </div>
      {perSkill.length > 0 && (
        <div className={styles.skills}>
          <ul className={styles.list} aria-label="Hours per skill">
            {perSkill.map((s) => (
              <li key={s.skill} className={styles.skill}>
                <span>{s.skill}</span>
                <span className={styles.hours}>{formatHours(s.minutes)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Each entry counts fully towards each of its skills, so these add up to more than the
            total.
          </p>
        </div>
      )}
    </section>
  )
}
