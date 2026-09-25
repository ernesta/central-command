import { sortSkills } from '@shared/skills'
import styles from './SkillChips.module.css'

/** An entry's skills as tags, in the shared order (alphabetical, then by group). Nothing when there are none. */
export function SkillChips({
  skills,
  stacked = false
}: {
  skills: readonly string[]
  /** One tag per line, for a table cell. */
  stacked?: boolean
}): React.JSX.Element {
  if (skills.length === 0) return <>—</>
  return (
    <ul
      className={[styles.chips, stacked && styles.stacked].filter(Boolean).join(' ')}
      aria-label="Skills"
    >
      {sortSkills(skills).map((skill) => (
        <li key={skill} className={styles.chip}>
          {skill}
        </li>
      ))}
    </ul>
  )
}
