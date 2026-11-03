import styles from './ShowMore.module.css'

/**
 * The line under a list that shows only its first rows: "Showing 5 of 12" and a link that opens the rest ("Show all") or
 * closes it again ("Show fewer"). Nothing when the list fits in `limit`.
 */
export function ShowMore({
  shown,
  total,
  limit,
  expanded,
  onToggle
}: {
  shown: number
  total: number
  limit: number
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element | null {
  if (total <= limit) return null
  return (
    <p className={styles.more}>
      <span>{expanded ? `Showing all ${total}` : `Showing ${shown} of ${total}`}</span>
      <button type="button" className={styles.toggle} onClick={onToggle}>
        {expanded ? 'Show fewer' : 'Show all'}
      </button>
    </p>
  )
}
