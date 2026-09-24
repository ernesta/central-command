import { findByInitials } from '../shared/people'
import type { Person } from '../shared/types'
import styles from './OwnerPill.module.css'

/** A TODO owner's initials as a small pill. Initials not in the people list are kept, and outlined. */
export function OwnerPill({
  initials,
  people
}: {
  initials: string
  people: readonly Person[]
}): React.JSX.Element {
  const person = findByInitials(people, initials)
  return (
    <span
      className={[styles.pill, !person && styles.unknown].filter(Boolean).join(' ')}
      title={person ? person.name : `${initials} is not in your people list`}
    >
      {initials}
    </span>
  )
}
