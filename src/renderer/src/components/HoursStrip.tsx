import { formatHours, sortSkills } from '@shared/skills'
import styles from './HoursStrip.module.css'

interface HoursStripProps {
  /** What the total is of, for example "Hours of meetings, 2025–26". */
  title: string
  minutes: number
  /** One quiet line under the total, for example "12 meetings · 2 without times". */
  note?: string
  perSkill: readonly { skill: string; minutes: number }[]
  /** A yearly aim: shows "of N h" and a thin bar. `progress` is the fraction done (it can pass 1). */
  aim?: { hours: number; progress: number }
  /** A quiet extra line under the total, for example the hours of meetings. */
  extra?: string
}

/** The total hours and the hours per skill, largest first. Shared by Meetings and Training. */
export function HoursStrip({
  title,
  minutes,
  note,
  perSkill,
  aim,
  extra
}: HoursStripProps): React.JSX.Element {
  return (
    <section className={styles.strip} aria-label={title}>
      <div className={styles.total}>
        <span className={styles.value}>
          {formatHours(minutes)}
          {aim && <span className={styles.aim}> of {aim.hours} h</span>}
        </span>
        {aim && (
          <div
            className={styles.bar}
            role="progressbar"
            aria-label="Progress towards the yearly aim"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(aim.progress * 100))}
          >
            <div
              className={styles.fill}
              style={{ width: `${Math.min(100, aim.progress * 100)}%` }}
            />
          </div>
        )}
        <span className={styles.title}>{title}</span>
        {note && <span className={styles.note}>{note}</span>}
        {extra && <span className={styles.note}>{extra}</span>}
      </div>
      {perSkill.length > 0 && (
        <div className={styles.skills}>
          <ul className={styles.list} aria-label="Hours per skill">
            {sortSkills(perSkill.map((s) => s.skill))
              .map((name) => perSkill.find((s) => s.skill === name)!)
              .map((s) => (
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
