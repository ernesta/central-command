import styles from './SearchNotices.module.css'

/** What the search made of the typed modifiers, when it could not take one as written: short lines above the results. */
export function SearchNotices({
  notices
}: {
  notices: readonly string[]
}): React.JSX.Element | null {
  if (notices.length === 0) return null
  return (
    <ul className={styles.notices} role="status">
      {notices.map((notice) => (
        <li key={notice}>{notice}</li>
      ))}
    </ul>
  )
}
