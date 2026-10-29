import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { Input } from '@renderer/components/Input'
import { Select } from '@renderer/components/Select'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { WORKSPACE_LABEL } from '../shared/rows'
import {
  WATCH_WORKSPACES,
  guessMethod,
  type WatchSource,
  type WatchWorkspace
} from '../shared/types'
import styles from './WatchSettings.module.css'

/** Add a source, or edit one (name, address, workspace) or remove it. Shown while it is wanted. */
export function SourceDialog({
  source,
  itemCount,
  onDone,
  onCancel
}: {
  /** The source being edited; absent for a new one. */
  source?: WatchSource
  /** How many items the source has announced, said when it is removed. */
  itemCount?: number
  onDone: () => void
  onCancel: () => void
}): React.JSX.Element {
  const [title, setTitle] = useState(source?.title ?? '')
  const [url, setUrl] = useState(source?.url ?? '')
  const [workspace, setWorkspace] = useState<WatchWorkspace>(source?.workspace ?? 'research')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (work: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await work()
      onDone()
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
    }
  }

  const save = (): Promise<void> =>
    run(async () => {
      if (source) {
        await window.api.watch.sources.update(source.id, {
          title,
          url,
          workspace,
          intervalHours: 24
        })
      } else {
        const added = await window.api.watch.sources.add({
          title,
          url,
          workspace,
          method: guessMethod(url),
          intervalHours: 24
        })
        // Look at it now, so the page has something to show (a source is only ever requested because it exists).
        void window.api.watch.checkNow(added.id).catch(() => undefined)
      }
    })

  if (confirming && source)
    return (
      <Dialog
        title="Remove source"
        onCancel={() => setConfirming(false)}
        busy={busy}
        actions={
          <>
            <Button autoFocus onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void run(() => window.api.watch.sources.remove(source.id))}
            >
              Remove
            </Button>
          </>
        }
      >
        <p>
          Remove “{source.title}”
          {itemCount ? ` and the ${itemCount} ${itemCount === 1 ? 'item' : 'items'} it found` : ''}?
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </Dialog>
    )

  const ready = title.trim() !== '' && url.trim() !== ''
  return (
    <Dialog
      title={source ? 'Edit source' : 'Add source'}
      onCancel={onCancel}
      busy={busy}
      actions={
        <>
          <Button autoFocus onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {source && (
            <>
              <Button variant="danger-outline" onClick={() => setConfirming(true)} disabled={busy}>
                Remove
              </Button>
              <span className={styles.spacer} />
            </>
          )}
          <Button variant="primary" onClick={() => void save()} disabled={busy || !ready}>
            {source ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (ready && !busy) void save()
        }}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Name</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Address</span>
          <Input
            inputMode="url"
            placeholder="https://"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Workspace</span>
          <Select
            label="Workspace"
            value={workspace}
            options={WATCH_WORKSPACES.map((w) => ({ value: w, label: WORKSPACE_LABEL[w] }))}
            onChange={setWorkspace}
          />
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
