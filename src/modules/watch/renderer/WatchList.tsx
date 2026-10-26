import { Bookmark, Undo2, X } from 'lucide-react'
import { CutText } from '@renderer/components/CutText'
import { IconButton } from '@renderer/components/IconButton'
import { Tooltip } from '@renderer/components/Tooltip'
import landing from '@renderer/components/Landing.module.css'
import { foundLabel, noteFor, titleParts } from '../shared/rows'
import type { WatchItem } from '../shared/types'
import type { WatchItems } from './useWatchItems'
import styles from './WatchList.module.css'

/**
 * Items as the landing's list of rows: the day found, the title (a "New" pill while unseen), its source, a deadline when
 * the text names one, and two icon buttons: save and dismiss (a dismissed item shows Restore instead). The row opens the
 * item's page in the browser.
 */
export function WatchList({
  items,
  today,
  actions
}: {
  items: readonly WatchItem[]
  today: string
  actions: Pick<WatchItems, 'toggleSaved' | 'dismiss' | 'restore' | 'open'>
}): React.JSX.Element {
  return (
    <ul className={`${landing.box} ${landing.recentList}`}>
      {items.map((item) => (
        <li key={item.id}>
          <div className={styles.row}>
            <span className={landing.date}>{foundLabel(item.firstSeenAt, today)}</span>
            <span className={styles.titleCell}>
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
              {item.state === 'new' && <span className={styles.new}>New</span>}
            </span>
            <CutText className={styles.note}>{titleParts(item.title).when}</CutText>
            <CutText className={styles.note}>{item.sourceTitle}</CutText>
            <CutText className={styles.note}>{noteFor(item, today)}</CutText>
            <span className={styles.actions}>
              {item.state === 'dismissed' ? (
                <IconButton label="Restore" onClick={() => actions.restore(item)}>
                  <Undo2 size={16} strokeWidth={1.75} />
                </IconButton>
              ) : (
                <>
                  <IconButton
                    label={item.state === 'saved' ? 'Saved' : 'Save'}
                    aria-pressed={item.state === 'saved'}
                    className={item.state === 'saved' ? styles.saved : undefined}
                    onClick={() => actions.toggleSaved(item)}
                  >
                    <Bookmark
                      size={16}
                      strokeWidth={1.75}
                      fill={item.state === 'saved' ? 'currentColor' : 'none'}
                    />
                  </IconButton>
                  <IconButton label="Dismiss" onClick={() => actions.dismiss(item)}>
                    <X size={16} strokeWidth={1.75} />
                  </IconButton>
                </>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
