import styles from './Badge.module.css'

/** The small pill after a title: "Upcoming" and "Now" on the landings, "Now" in the tables. */
export function Badge({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className={styles.badge}>{children}</span>
}
