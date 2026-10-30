import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { ExternalIcon } from '@renderer/components/ExternalIcon'
import { Panel } from '@renderer/components/Panel'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { SECTION_NOUN, taskWatchLabel } from '../../watch/shared/rows'
import type { WatchItem } from '../../watch/shared/types'
import type { Task } from '../shared/types'
import styles from './WatchPanel.module.css'

/** The Watch item a task was made from, as the side column says what the app knows about it: its title as an external link, what it is and its date. */
function useWatchItem(id: number | null): WatchItem | null {
  const [found, setFound] = useState<{ id: number; item: WatchItem | null } | null>(null)
  useEffect(() => {
    if (id === null) return
    let cancelled = false
    const load = (): void => {
      void window.api.watch.items
        .get(id)
        .then((item) => {
          if (!cancelled) setFound({ id, item })
        })
        .catch(() => undefined)
    }
    load()
    const off = window.api.watch.onChanged(load)
    return () => {
      cancelled = true
      off()
    }
  }, [id])
  return found && found.id === id ? found.item : null
}

/** The address' own host, for a link whose item is gone ("jacobsfoundation.org"). */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Side-column Panel "Watch" for a task made from a Watch item: the item's title as an external link (the task's own copy of the
 * address when the item is gone), its section and its deadline or date, and "Unlink", which clears the link and leaves both sides alone.
 * Nothing for a task with no link.
 */
export function WatchPanel({
  task,
  today,
  onError
}: {
  task: Task
  today: string
  onError: (message: string) => void
}): React.JSX.Element | null {
  const item = useWatchItem(task.watchItemId)
  if (task.watchItemId === null && task.watchUrl === null) return null
  const url = item?.url ?? task.watchUrl
  const line = item
    ? [SECTION_NOUN[item.section].one, taskWatchLabel(item, today)].filter(Boolean).join(' · ')
    : ''
  return (
    <Panel
      label="Watch"
      actions={
        <Button
          size="small"
          onClick={() =>
            void window.api.tasks.update(task.uid, { unlink: true }).catch((e: unknown) => {
              onError(ipcErrorMessage(e))
            })
          }
        >
          Unlink
        </Button>
      }
    >
      {url && (
        <a className={styles.link} href={url} target="_blank" rel="noreferrer">
          <ExternalIcon />
          <span className={styles.text}>{item?.title ?? hostOf(url)}</span>
        </a>
      )}
      {line && <p className={styles.line}>{line}</p>}
    </Panel>
  )
}
