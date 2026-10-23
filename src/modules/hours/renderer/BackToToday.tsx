import styles from './BackToToday.module.css'

interface BackToTodayProps {
  /** "This week" or "This month". */
  label: string
  onClick: () => void
}

/** A quiet button beside the arrows that returns to the current period; the caller renders it only while away from it. */
export function BackToToday({ label, onClick }: BackToTodayProps): React.JSX.Element {
  return (
    <button type="button" className={styles.button} onClick={onClick}>
      {label}
    </button>
  )
}
