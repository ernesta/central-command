import { Fragment, useEffect, useState } from 'react'
import { CutText } from '@renderer/components/CutText'
import { ExternalIcon } from '@renderer/components/ExternalIcon'
import { GroupRow } from '@renderer/components/GroupRow'
import { Tooltip } from '@renderer/components/Tooltip'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import shared from '@renderer/components/ListTable.module.css'
import { deadlineFor, foundLabel, titleParts, whenFor } from '../shared/rows'
import { cutGroups, openedWith, type WatchGroup } from '../shared/query'
import { ItemActions } from './ItemActions'
import type { EntryActions } from './useManualEntries'
import type { WatchItems } from './useWatchItems'
import styles from './WatchAllPage.module.css'

/** Column widths; the title takes the rest. */
const WIDTHS = { found: 128, when: 190, deadline: 170, source: 240, actions: 132 }
const HEADINGS = ['Found', 'Title', 'When', 'Deadline', 'Source', '']

/**
 * Found, Title, When, Deadline, Source and the two icon buttons, one 48px line each, under Saved / New / Read headers in "All", each
 * group cut after its first rows with a "Show N more" row. Like the Training table it is one tab stop (arrow keys, Home/End,
 * Enter opens the item's page in the browser).
 */
export function WatchTable({
  groups: all,
  today,
  label,
  focusId = null,
  actions
}: {
  groups: readonly WatchGroup[]
  today: string
  label: string
  /** The item a search hit asked for: its group is opened, it is scrolled to and lit for a moment. */
  focusId?: number | null
  actions: Pick<WatchItems, 'toggleSaved' | 'toggleRead' | 'open'> & Partial<EntryActions>
}): React.JSX.Element {
  const [opened, setOpened] = useState<ReadonlySet<WatchGroup['key']>>(new Set())
  const groups = cutGroups(all, openedWith(all, opened, focusId))
  const found = all.some((g) => g.rows.some((r) => r.id === focusId))
  useEffect(() => {
    if (focusId === null || !found) return
    document.querySelector(`tr[data-watch-item="${focusId}"]`)?.scrollIntoView({ block: 'center' })
  }, [focusId, found])
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
          <col style={{ width: WIDTHS.when }} />
          <col style={{ width: WIDTHS.deadline }} />
          <col style={{ width: WIDTHS.source }} />
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
                    data-watch-item={item.id}
                    className={item.id === focusId ? `${shared.row} ${styles.found}` : shared.row}
                    {...rowProps(first + offset)}
                    onClick={() => actions.open(item)}
                  >
                    <td className={shared.nums}>
                      <CutText>{foundLabel(item.firstSeenAt, today)}</CutText>
                    </td>
                    <td>
                      <div className={styles.titleLine}>
                        <span className={styles.ext}>
                          <ExternalIcon />
                        </span>
                        <Tooltip text={titleParts(item.title).name} whenCut>
                          <a
                            className={
                              item.state === 'seen'
                                ? `${styles.title} ${styles.read}`
                                : styles.title
                            }
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
                            {titleParts(item.title).name}
                          </a>
                        </Tooltip>
                      </div>
                    </td>
                    <td className={styles.muted}>
                      <CutText>{whenFor(item)}</CutText>
                    </td>
                    <td className={styles.muted}>
                      <CutText>{deadlineFor(item, today)}</CutText>
                    </td>
                    <td className={styles.muted}>
                      <CutText>{item.sourceTitle}</CutText>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <ItemActions item={item} actions={actions} />
                    </td>
                  </tr>
                ))}
                {group.hidden > 0 && (
                  <tr>
                    <td colSpan={HEADINGS.length} className={styles.moreCell}>
                      <button
                        type="button"
                        className={styles.more}
                        onClick={() => setOpened(new Set([...opened, group.key]))}
                      >
                        Show {group.hidden} more
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
