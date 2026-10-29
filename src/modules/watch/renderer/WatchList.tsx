import { CutText } from '@renderer/components/CutText'
import { ExternalIcon } from '@renderer/components/ExternalIcon'
import { Tooltip } from '@renderer/components/Tooltip'
import landing from '@renderer/components/Landing.module.css'
import { deadlineFor, foundLabel, titleParts, whenFor } from '../shared/rows'
import type { WatchItem } from '../shared/types'
import { ItemActions } from './ItemActions'
import type { EntryActions } from './useManualEntries'
import type { WatchItems } from './useWatchItems'
import styles from './WatchList.module.css'

/**
 * Items as the landing's list of rows: the day found, the title (a "New" pill while unseen), when it is, its deadline when
 * it has one, its source, and two icon buttons: Mark read and Save. The row opens the
 * item's page in the browser.
 */
export function WatchList({
  items,
  today,
  actions
}: {
  items: readonly WatchItem[]
  today: string
  actions: Pick<WatchItems, 'toggleSaved' | 'toggleRead' | 'open'> & Partial<EntryActions>
}): React.JSX.Element {
  return (
    <ul className={`${landing.box} ${landing.recentList}`}>
      {items.map((item) => (
        <li key={item.id}>
          {/* Only a row the user opened this visit is Read on this page (`Held`): it stays where it was, dimmed. */}
          <div className={item.state === 'seen' ? `${styles.row} ${styles.held}` : styles.row}>
            <span className={landing.date}>{foundLabel(item.firstSeenAt, today)}</span>
            <span className={styles.titleCell}>
              <span className={styles.ext}>
                <ExternalIcon />
              </span>
              <Tooltip text={titleParts(item.title).name} whenCut>
                <a
                  className={styles.title}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    event.preventDefault()
                    actions.open(item)
                  }}
                >
                  {titleParts(item.title).name}
                </a>
              </Tooltip>
            </span>
            <CutText className={styles.note}>{whenFor(item)}</CutText>
            <CutText className={styles.note}>{deadlineFor(item, today)}</CutText>
            <CutText className={styles.note}>{item.sourceTitle}</CutText>
            <ItemActions item={item} actions={actions} />
          </div>
        </li>
      ))}
    </ul>
  )
}
