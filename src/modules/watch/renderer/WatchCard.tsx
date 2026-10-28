import { Link } from 'react-router'
import { useWatchItems } from './useWatchItems'
import { useWatchSources } from './useWatchSources'
import { useWatchWorkspace, watchBase } from './watch-paths'
import styles from './WatchCard.module.css'

/** Watch on a workspace's landing: how many new things there are, or that nothing is watched yet. */
export function WatchCard(): React.JSX.Element {
  const workspace = useWatchWorkspace()
  const { sources } = useWatchSources(workspace)
  const { items } = useWatchItems({ state: 'new', limit: 1000 })
  const count = items?.length ?? 0

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={watchBase(workspace)}>
          Watch
        </Link>
      </h2>
      {sources === null || items === null ? null : sources.length === 0 ? (
        <p className={styles.line}>Nothing watched yet</p>
      ) : (
        <p className={styles.line}>
          {count === 0 ? 'Nothing new' : `${count} new`} · {sources.length}{' '}
          {sources.length === 1 ? 'source' : 'sources'}
        </p>
      )}
    </div>
  )
}
