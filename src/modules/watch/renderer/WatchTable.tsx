import { Fragment } from 'react'
import { Bookmark, Undo2, X } from 'lucide-react'
import { CutText } from '@renderer/components/CutText'
import { GroupRow } from '@renderer/components/GroupRow'
import { IconButton } from '@renderer/components/IconButton'
import { Tooltip } from '@renderer/components/Tooltip'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import shared from '@renderer/components/ListTable.module.css'
import { foundLabel, noteFor } from '../shared/rows'
import type { WatchGroup } from '../shared/query'
import type { WatchItems } from './useWatchItems'
import styles from './WatchAllPage.module.css'

/** Column widths; the title takes the rest. */
const WIDTHS = { found: 128, source: 280, note: 160, actions: 96 }
const HEADINGS = ['Found', 'Title', 'Source', 'Note', '']

/**
 * Found, Title, Source, Note and the two icon buttons, one 48px line each, "New" above "Earlier". Like the Training table
 * it is one tab stop (arrow keys, Home/End, Enter opens the item's page in the browser).
 */
export function WatchTable({
  groups,
  today,
  label,
  actions
}: {
  groups: readonly WatchGroup[]
  today: string
  label: string
  actions: Pick<WatchItems, 'toggleSaved' | 'dismiss' | 'restore' | 'open'>
}): React.JSX.Element {
  const ordered = groups.flatMap((g) => g.rows)
  const { tableProps, rowProps } = useRowNavigation(ordered.length, (index) =>
    actions.open(ordered[index])
  )
  const starts = groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.rows.length, 0))

  return (
    <div className={shared.wrap}>
      <table className={shared.table} aria-label={label} {...tableProps}>
        <colgroup>
          <col style={{ width: WIDTHS.found }} />
          <col />
          <col style={{ width: WIDTHS.source }} />
          <col style={{ width: WIDTHS.note }} />
          <col style={{ width: WIDTHS.actions }} />
        </colgroup>
        <thead>
          <tr>
            {HEADINGS.map((heading, i) => (
              <th key={i} className={shared.th} scope="col" aria-label={heading || 'Actions'}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIndex) => {
            const first = starts[groupIndex]
            return (
              <Fragment key={group.key}>
                {group.label && <GroupRow label={group.label} colSpan={HEADINGS.length} />}
                {group.rows.map((item, offset) => (
                  <tr
                    key={item.id}
                    className={shared.row}
                    {...rowProps(first + offset)}
                    onClick={() => actions.open(item)}
                  >
                    <td className={shared.nums}>
                      <CutText>{foundLabel(item.firstSeenAt, today)}</CutText>
                    </td>
                    <td>
                      <div className={styles.titleLine}>
                        <Tooltip text={item.title} whenCut>
                          <a
                            className={styles.title}
                            href={item.url}
                            tabIndex={-1}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              actions.open(item)
                            }}
                          >
                            {item.title}
                          </a>
                        </Tooltip>
                        {item.state === 'new' && <span className={styles.new}>New</span>}
                      </div>
                    </td>
                    <td className={styles.muted}>
                      <CutText>{item.sourceTitle}</CutText>
                    </td>
                    <td className={styles.muted}>
                      <CutText>{noteFor(item, today)}</CutText>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
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
                    </td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
