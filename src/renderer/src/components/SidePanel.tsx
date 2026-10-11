import styles from './SidePanel.module.css'

interface SidePanelProps {
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
 * One card in a page's side column: a small-caps label, whatever actions belong beside it, and the
 * panel's own content. The column (`DocSplit`) keeps itself in view and scrolls, so a panel is a
 * plain card and every side panel in the app looks the same.
 */
export function SidePanel({
  label,
  heading,
  actions,
  as: Landmark = 'section',
  children
}: SidePanelProps): React.JSX.Element {
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
