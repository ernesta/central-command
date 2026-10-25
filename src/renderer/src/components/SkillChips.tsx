import { sortSkills } from '@shared/skills'
import { CutText } from './CutText'
import { Tooltip } from './Tooltip'
import styles from './SkillChips.module.css'

/**
 * An entry's skills as tags, in the shared order (alphabetical, then by group). Nothing when there are none.
 * With a `limit` (a table cell) the first ones show and the rest are a muted "+N" whose tooltip lists them.
 */
export function SkillChips({
  skills,
  limit
}: {
  skills: readonly string[]
  /** Show at most this many tags, then "+N". */
  limit?: number
}): React.JSX.Element {
  if (skills.length === 0) return <>—</>
  const sorted = sortSkills(skills)
  const shown = limit === undefined ? sorted : sorted.slice(0, limit)
  const rest = sorted.slice(shown.length)
  return (
    <ul
      className={[styles.chips, limit !== undefined && styles.oneLine].filter(Boolean).join(' ')}
      aria-label="Skills"
    >
      {shown.map((skill) => (
        <li key={skill} className={styles.chip}>
          {limit === undefined ? skill : <CutText>{skill}</CutText>}
        </li>
      ))}
      {rest.length > 0 && (
        <li className={styles.more}>
          <Tooltip text={rest.join(', ')}>
            <span>+{rest.length}</span>
          </Tooltip>
        </li>
      )}
    </ul>
  )
}
