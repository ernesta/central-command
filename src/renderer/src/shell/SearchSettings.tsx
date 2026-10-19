import { allSummaries } from '@shared/search-help'
import { ModifierChip } from './ModifierChip'
import styles from './SearchSettings.module.css'

/** The search modifiers, read from the same table the search and its help row use, so this page cannot drift from them. */
export function SearchSettings(): React.JSX.Element {
  return (
    <section className={styles.card} aria-labelledby="search-title">
      <h2 id="search-title" className={styles.title}>
        Search filters
      </h2>
      <p className={styles.help}>
        Type name:value in the search box. A - in front leaves matches out; quote a value with
        spaces.
      </p>
      <dl className={styles.list}>
        {allSummaries().map((summary) => (
          <div key={summary.name} className={styles.row}>
            <dt className={styles.name}>{summary.name}:</dt>
            <dd className={styles.what}>
              {summary.filters}
              <span className={styles.values}>
                {summary.chips.map((chip) => (
                  <ModifierChip key={chip.label} label={chip.label} />
                ))}
                {summary.line}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
