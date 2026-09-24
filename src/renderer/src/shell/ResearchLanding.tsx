import { liveModules, plannedModulesFor } from '@modules/index'
import styles from './ResearchLanding.module.css'

export function ResearchLanding(): React.JSX.Element {
  const live = liveModules('research').filter((m) => m.landingCard)
  const planned = plannedModulesFor('research')

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Research</h1>
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
