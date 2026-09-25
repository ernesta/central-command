import { AllLink } from '@renderer/components/Landing'
import { peopleRoute } from './meetings-paths'
import styles from './PeopleSettings.module.css'

/** Settings only points to the People page, where the list is kept. */
export function PeopleSettings(): React.JSX.Element {
  return (
    <section className={styles.card} aria-labelledby="people-title">
      <h2 id="people-title" className={styles.title}>
        People
      </h2>
      <p className={styles.help}>The people you meet and train with, and their initials.</p>
      <div>
        <AllLink to={peopleRoute}>Open people</AllLink>
      </div>
    </section>
  )
}
