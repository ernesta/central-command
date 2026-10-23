import styles from './EntityLink.module.css'
import { Link } from 'react-router'
import { CalendarDays, GraduationCap, ListChecks, type LucideIcon } from 'lucide-react'

/** The icon of the kinds of thing the app links to by name: the same Lucide icons the `@` picker and the mention chips show. */
const KIND_ICONS = {
  task: ListChecks,
  meeting: CalendarDays,
  training: GraduationCap
} as const

export type EntityLinkKind = keyof typeof KIND_ICONS

/**
 * A link to a task, meeting, training or series from running text or a panel: the kind's icon and the name in the quiet chip the
 * editor draws for a mention, never an underline. Pass `icon` to override the kind's.
 */
export function EntityLink({
  to,
  kind,
  icon,
  children
}: {
  to: string
  kind: EntityLinkKind
  icon?: LucideIcon
  children: React.ReactNode
}): React.JSX.Element {
  const Icon = icon ?? KIND_ICONS[kind]
  return (
    <Link className={styles.link} to={to}>
      <Icon className={styles.icon} size={13} strokeWidth={1.75} aria-hidden />
      <span className={styles.name}>{children}</span>
    </Link>
  )
}
