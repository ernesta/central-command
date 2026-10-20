import { Link } from 'react-router'
import styles from './Home.module.css'

/** A quiet text link in a card's heading row ("Hours", "See all"). */
export function StyledLink({
  to,
  children
}: {
  to: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Link className={styles.link} to={to}>
      {children}
    </Link>
  )
}

/** The message in a card that has nothing to list. */
export function None({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className={styles.none}>{children}</p>
}
