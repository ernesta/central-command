import { HomeDate, HomePage } from '@modules/home/renderer/HomePage'
import { liveModules, plannedModulesFor } from '@modules/index'
import type { Workspace } from '@shared/settings'
import { WORKSPACE_LABELS } from './workspaces'
import styles from './WorkspaceLanding.module.css'

/** A workspace's landing page: Home (Research and Work), then a card per live module that wants one, then "Coming soon" for the rest. */
export function WorkspaceLanding({
  workspace,
  actions
}: {
  workspace: Workspace
  actions?: React.ReactNode
}): React.JSX.Element {
  const live = liveModules(workspace).filter((m) => m.landingCard)
  const planned = plannedModulesFor(workspace)
  const hasHome = workspace === 'research' || workspace === 'work'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.title}>
          <h1 className={styles.heading}>{WORKSPACE_LABELS[workspace]}</h1>
          {hasHome && <HomeDate />}
        </div>
        {actions}
      </header>
      {hasHome && <HomePage workspace={workspace} />}
      {live.length > 0 && (
        <div className={styles.live}>
          {live.map(({ id, landingCard: Card }) => (Card ? <Card key={id} /> : null))}
        </div>
      )}
      {planned.length > 0 && (
        <section className={styles.soon} aria-label="Coming soon">
          <p className={styles.soonLabel}>Coming soon</p>
          <div className={styles.soonRow}>
            {planned.map((m) => (
              <div key={m.id} className={styles.soonCard}>
                {m.label}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
