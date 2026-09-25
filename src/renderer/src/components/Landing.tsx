import { ArrowLeft, Pin } from 'lucide-react'
import { Link } from 'react-router'
import styles from './Landing.module.css'

/** A module's landing page: a page wrapper so every module's landing looks and behaves alike. */
export function LandingPage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className={styles.page}>{children}</div>
}

/** Back link, title and the actions at the right (a link to the full list, a "New …" button). */
export function LandingHeader({
  backTo,
  backLabel,
  title,
  actions
}: {
  backTo: string
  backLabel: string
  title: string
  actions: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={styles.top}>
      <Link className={styles.back} to={backTo}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        {backLabel}
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>{title}</h1>
        <div className={styles.actions}>{actions}</div>
      </header>
    </div>
  )
}

/** A button-like link in a landing header, for a page that belongs to the module (for example "Training plan"). */
export function AllLink({
  to,
  state,
  children
}: {
  to: string
  /** Router state for the page opened, for example where the visitor came from. */
  state?: unknown
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Link className={styles.allLink} to={to} state={state}>
      {children}
    </Link>
  )
}

/** A labelled section; `aside` sits at the right of the label (a selector, a "see all" link). */
export function LandingSection({
  id,
  label,
  aside,
  children
}: {
  id: string
  label: string
  aside?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h2 id={id} className={styles.label}>
          {label}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** "See all meetings →" style link for a section's aside. */
export function SeeAllLink({
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

export interface SeriesCard {
  key: string
  to: string
  title: string
  line: string
  /** A second line under the first (the subgroups of a group). */
  extra?: string
  /** A card for a pinned note: the title carries a pin. */
  pinned?: boolean
  /** A card for what has no group: drawn with a dashed border. */
  dashed?: boolean
}

/** One narrow card per series (or group, or pinned note); the whole card opens what it stands for. */
export function SeriesCards({ cards }: { cards: readonly SeriesCard[] }): React.JSX.Element {
  return (
    <div className={styles.cards}>
      {cards.map((c) => (
        <div
          key={c.key}
          className={[styles.card, c.dashed && styles.dashed].filter(Boolean).join(' ')}
        >
          <h3 className={styles.cardTitle}>
            {c.pinned && (
              <Pin
                size={14}
                strokeWidth={1.75}
                fill="currentColor"
                className={styles.pinIcon}
                aria-label="Pinned"
              />
            )}
            <Link className={styles.cardLink} to={c.to}>
              {c.title}
            </Link>
          </h3>
          <p className={styles.line}>{c.line}</p>
          {c.extra && <p className={styles.line}>{c.extra}</p>}
        </div>
      ))}
    </div>
  )
}

export interface RecentRow {
  key: string
  to: string
  date: string
  /** "Upcoming" or "Planned" beside the title, when it has not happened. */
  badge?: string
  title: string
  /** Initials of the people involved (the first three are shown). */
  people: readonly { name: string; initials: string }[]
  note: string
}

/** The short "recent and upcoming" list: date, title, people, a note at the right. */
export function RecentList({ rows }: { rows: readonly RecentRow[] }): React.JSX.Element {
  return (
    <ul className={styles.box + ' ' + styles.recentList}>
      {rows.map((row) => (
        <li key={row.key}>
          <Link className={styles.recent} to={row.to}>
            <span className={styles.date}>{row.date}</span>
            <span>
              {row.title}
              {row.badge && <span className={styles.upcoming}>{row.badge}</span>}
            </span>
            <span className={styles.chips}>
              {row.people.slice(0, 3).map((p) => (
                <span key={p.name} className={styles.chip} title={p.name}>
                  {p.initials}
                </span>
              ))}
              {row.people.length > 3 && (
                <span className={styles.more}>+{row.people.length - 3}</span>
              )}
            </span>
            <span className={styles.note}>{row.note}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Quiet explanatory text under a section. */
export function LandingHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className={styles.hint}>{children}</p>
}

/** A white card that holds a list or a message. */
export function LandingBox({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className={styles.box}>{children}</div>
}

/** The quiet message inside a box when there is nothing to list. */
export function LandingNone({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className={styles.none}>{children}</p>
}
