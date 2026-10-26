import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { CutText } from '@renderer/components/CutText'
import { Tooltip } from '@renderer/components/Tooltip'
import { KIND_LABEL, checkedLabel } from '../shared/rows'
import type { WatchItem } from '../shared/types'
import { SourceDialog } from './SourceDialog'
import { todayIso } from './watch-paths'
import { useWatchSources } from './useWatchSources'
import styles from './WatchSettings.module.css'

type Dialogue = { kind: 'add' } | { kind: 'edit'; id: number } | null

/** Settings → Watch: the sources (a plain table, a row opens its dialog). */
export function WatchSettings(): React.JSX.Element {
  const { sources, reload } = useWatchSources()
  const [dialog, setDialog] = useState<Dialogue>(null)
  const [counts, setCounts] = useState<Map<number, number>>(new Map())
  const today = todayIso()
  const shown = sources?.length ?? -1

  // The items per source are for "Remove": read again when the sources change.
  useEffect(() => {
    let cancelled = false
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
            Nothing is watched yet, so nothing is requested. Add a page or feed.
          </p>
        ) : (
          <div className={styles.wrap}>
            <table className={styles.table} aria-label="Sources">
              <colgroup>
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 170 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Source', 'Kind', 'Last checked'].map((h) => (
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
