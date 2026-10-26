import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { Input } from '@renderer/components/Input'
import { Select, type SelectOption } from '@renderer/components/Select'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { EVERY_OPTIONS, KIND_LABEL, everyLabel } from '../shared/rows'
import { guessMethod, shownKind, type WatchKind, type WatchSource } from '../shared/types'
import styles from './WatchSettings.module.css'

const SHOWN: WatchKind[] = ['training', 'conference']

/** The kinds to choose from: the two the page shows, and a source's own odd kind (a journal added earlier) so that saving it changes nothing. */
function kindOptions(current: WatchKind): SelectOption<WatchKind>[] {
  const kinds = SHOWN.includes(current) || shownKind(current) ? SHOWN : [...SHOWN, current]
  return kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))
}

/** Add a source, or edit one (name, address, kind, how often) or remove it. Shown while it is wanted. */
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
  const [kind, setKind] = useState<WatchKind>(
    source
      ? shownKind(source.kind)
        ? (shownKind(source.kind) as WatchKind)
        : source.kind
      : 'training'
  )
  const [hours, setHours] = useState(String(source?.intervalHours ?? 24))
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const everyOptions: SelectOption<string>[] = [
    ...EVERY_OPTIONS.map((o) => ({ value: String(o.hours), label: o.label })),
    ...(EVERY_OPTIONS.some((o) => String(o.hours) === hours)
      ? []
      : [{ value: hours, label: everyLabel(Number(hours)) }])
  ]

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
          kind,
          intervalHours: Number(hours)
        })
      } else {
        const added = await window.api.watch.sources.add({
          title,
          url,
          kind,
          method: guessMethod(url),
          intervalHours: Number(hours)
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
        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Kind</span>
            <Select
              label="Kind"
              value={kind}
              options={kindOptions(source?.kind ?? 'training')}
              onChange={setKind}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Every</span>
            <Select label="Every" value={hours} options={everyOptions} onChange={setHours} />
          </div>
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
