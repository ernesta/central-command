import styles from './Panel.module.css'

interface PanelProps {
  /** What the panel is called: its heading, and the name read out for the landmark. */
  label: string
  /** A heading that says more than the label does (“Topics · 2 of 5 discussed”). */
  heading?: React.ReactNode
  /** Buttons beside the heading. */
  actions?: React.ReactNode
  /** The landmark: `nav` for a way around the page, `aside` for something beside it, `section` otherwise. */
  as?: 'section' | 'aside' | 'nav'
  children?: React.ReactNode
}

/**
 * One labelled card: a small-caps label, whatever actions belong beside it, and the card's own
 * content. Used in a page's side column, where `DocSplit` keeps the column in view and scrolls it,
 * and in the body of a page for a block that is not the text itself (a reading's reference, its
 * abstract), so every card in the app looks the same.
 */
export function Panel({
  label,
  heading,
  actions,
  as: Landmark = 'section',
  children
}: PanelProps): React.JSX.Element {
  return (
    <Landmark className={styles.panel} aria-label={label}>
      <div className={styles.head}>
        <h2 className={styles.label}>{heading ?? label}</h2>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </Landmark>
  )
}
