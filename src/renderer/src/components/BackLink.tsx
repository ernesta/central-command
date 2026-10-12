import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import styles from './BackLink.module.css'

/**
 * The one back link of every page. It stays in view while the page scrolls.
 *
 * With `history`, a page opened from somewhere (a task from a training, a meeting from a person) goes back to
 * exactly where the visitor came from, the way the mouse's back button and Cmd-[ do, and says just "Back".
 * Without history (the page was the first this window showed) it goes to `to`, named `label`. Without `history`
 * it is a plain link up to `to`, for a landing or list page whose parent never changes.
 */
export function BackLink({
  to,
  label,
  history = false
}: {
  to: string
  label: string
  history?: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const fromHistory = history && location.key !== 'default'
  return (
    <Link
      className={styles.back}
      to={to}
      onClick={(event) => {
        if (!fromHistory) return
        event.preventDefault()
        void navigate(-1)
      }}
    >
      <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
      {fromHistory ? 'Back' : label}
    </Link>
  )
}
