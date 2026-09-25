import styles from './FilterRow.module.css'

/**
 * The row of controls above a list. Every list uses the same order, matching the columns: academic year,
 * search, then series, type, skill and people ("Anyone").
 */
export function FilterRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className={styles.filters}>{children}</div>
}
