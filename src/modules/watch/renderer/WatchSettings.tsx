import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { CutText } from '@renderer/components/CutText'
import { Segmented } from '@renderer/components/Segmented'
import { Select } from '@renderer/components/Select'
import { useSettings } from '@renderer/state/settings-context'
import { Tooltip } from '@renderer/components/Tooltip'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { BY_HAND } from '../shared/by-hand'
import { KIND_LABEL, checkedLabel, everyLabel } from '../shared/rows'
import type { WatchItem, WatchSuggestion } from '../shared/types'
import { SourceDialog } from './SourceDialog'
import { todayIso } from './watch-paths'
import { useWatchSources } from './useWatchSources'
import styles from './WatchSettings.module.css'

const ON_OFF = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' }
] as const

/** How many days before a saved item's deadline to say so. */
const BEFORE = [
  { value: '0', label: 'Off' },
  { value: '1', label: '1 day before' },
  { value: '3', label: '3 days before' },
  { value: '7', label: '7 days before' },
  { value: '14', label: '14 days before' }
]

type Dialogue = { kind: 'add' } | { kind: 'edit'; id: number } | null

/** Settings → Watch: the sources (a plain table, a row opens its dialog), suggestions to add in one click, and the places to check by hand. */
export function WatchSettings(): React.JSX.Element {
  const { sources, reload } = useWatchSources()
  const { settings, update } = useSettings()
  const notify = settings.home.notifications
  const [dialog, setDialog] = useState<Dialogue>(null)
  const [suggestions, setSuggestions] = useState<WatchSuggestion[]>([])
  const [counts, setCounts] = useState<Map<number, number>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const today = todayIso()
  const shown = sources?.length ?? -1

  // Suggestions are what is not watched yet, and the items per source are for "Remove": read again when the sources change.
  useEffect(() => {
    let cancelled = false
    void window.api.watch.sources.suggestions().then((next) => {
      if (!cancelled) setSuggestions(next)
    })
    void window.api.watch.items.list({ limit: 1000 }).then((items: WatchItem[]) => {
      if (cancelled) return
      const next = new Map<number, number>()
      for (const i of items) next.set(i.sourceId, (next.get(i.sourceId) ?? 0) + 1)
      setCounts(next)
    })
    return () => {
      cancelled = true
    }
  }, [shown])

  const addSuggestion = async (s: WatchSuggestion): Promise<void> => {
    setError(null)
    try {
      const added = await window.api.watch.sources.add({
        title: s.title,
        url: s.url,
        kind: s.kind,
        method: s.method,
        groupLabel: s.groupLabel
      })
      void window.api.watch.checkNow(added.id).catch(() => undefined)
      reload()
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  const editing = dialog?.kind === 'edit' ? sources?.find((s) => s.id === dialog.id) : undefined

  return (
    <section className={styles.section} aria-labelledby="watch-settings">
      <div className={styles.head}>
        <h2 id="watch-settings" className={styles.heading}>
          Watch
        </h2>
        <Button
          icon={<Plus size={16} strokeWidth={1.75} aria-hidden />}
          onClick={() => setDialog({ kind: 'add' })}
        >
          Add source
        </Button>
      </div>

      <div>
        <h3 className={styles.label}>Sources</h3>
        {sources !== null && sources.length === 0 ? (
          <p className={styles.help}>
            Nothing is watched yet, so nothing is requested. Add a page or feed, or one of the
            suggestions below.
          </p>
        ) : (
          <div className={styles.wrap}>
            <table className={styles.table} aria-label="Sources">
              <colgroup>
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 170 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Source', 'Kind', 'Every', 'Last checked'].map((h) => (
                    <th key={h} className={styles.th} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sources ?? []).map((s) => {
                  const checked = checkedLabel(s, today)
                  return (
                    <tr
                      key={s.id}
                      className={styles.row}
                      onClick={() => setDialog({ kind: 'edit', id: s.id })}
                    >
                      <td>
                        <button
                          type="button"
                          className={styles.name}
                          onClick={(event) => {
                            event.stopPropagation()
                            setDialog({ kind: 'edit', id: s.id })
                          }}
                        >
                          {s.title}
                        </button>
                        <CutText className={styles.address}>{s.url}</CutText>
                      </td>
                      <td className={styles.muted}>{KIND_LABEL[s.kind]}</td>
                      <td className={styles.muted}>{everyLabel(s.intervalHours)}</td>
                      <td className={checked.failing ? styles.failing : styles.muted}>
                        {checked.failing && s.lastError ? (
                          <Tooltip text={s.lastError}>
                            <span>{checked.text}</span>
                          </Tooltip>
                        ) : (
                          checked.text
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div>
          <h3 className={styles.label}>Suggestions</h3>
          <ul className={styles.suggestions}>
            {suggestions.map((s) => (
              <li key={s.url} className={styles.suggestion}>
                <span className={styles.suggestionName}>{s.title}</span>
                <Button
                  size="small"
                  aria-label={`Add ${s.title}`}
                  onClick={() => void addSuggestion(s)}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className={styles.label}>Notifications</h3>
        <div className={styles.notify}>
          <div className={styles.field}>
            <span>Tell me about new items</span>
            <Segmented
              label="New items"
              value={notify.watchNew ? 'on' : 'off'}
              options={ON_OFF}
              onChange={(value) =>
                void update({ home: { notifications: { watchNew: value === 'on' } } })
              }
            />
          </div>
          <div className={styles.field}>
            <span>Remind me of a saved deadline</span>
            <Select
              label="Saved deadline reminder"
              value={String(notify.watchSavedDays)}
              options={BEFORE}
              onChange={(value) =>
                void update({ home: { notifications: { watchSavedDays: Number(value) } } })
              }
            />
          </div>
        </div>
        <p className={styles.help}>Mac notifications, off until you turn them on.</p>
      </div>

      <div>
        <h3 className={styles.label}>By hand</h3>
        <ul className={styles.byHand}>
          {BY_HAND.map((line) => (
            <li key={line.name} className={styles.hand}>
              <span>{line.name}</span>
              <span className={styles.muted}>{line.why}</span>
            </li>
          ))}
        </ul>
      </div>

      {dialog?.kind === 'add' && (
        <SourceDialog
          onDone={() => {
            setDialog(null)
            reload()
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {editing && (
        <SourceDialog
          key={editing.id}
          source={editing}
          itemCount={counts.get(editing.id)}
          onDone={() => {
            setDialog(null)
            reload()
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </section>
  )
}
