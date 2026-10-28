import { Fragment } from 'react'
import { FileText, Folder, TextAlignStart } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { CutText } from '@renderer/components/CutText'
import { InitialsChips } from '@renderer/components/InitialsChips'
import { SkillChips } from '@renderer/components/SkillChips'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import type { Person } from '@shared/people'
import { hasSummary } from '@shared/summary'
import { clockNow, formatDate } from '@shared/time'
import { layoutRows } from '@shared/upcoming-groups'
import { GroupRow } from '@renderer/components/GroupRow'
import { Tooltip } from '@renderer/components/Tooltip'
import { durationWithStudy } from '../shared/row-time'
import { formatTimeRange, initialsFor } from '@modules/meetings/shared/query'
import { entryParts, isUpcoming, type SelfStudy } from '../shared/rules'
import type { TrainingIndexRow, TrainingWorkspace } from '../shared/types'
import { entryRoute } from './training-paths'
import shared from '@renderer/components/ListTable.module.css'
import styles from './TrainingTable.module.css'

/** Column widths; the title takes the rest. */
const WIDTHS = { date: 128, time: 124, duration: 130, series: 200, skills: 190, leads: 188 }

/**
 * Date, Time, Duration, Series, Title, Skills, Leads. Clicking anywhere on a row opens
 * the entry. Like the Notes table, it is one tab stop: arrow keys, Home/End and PageUp/PageDown move
 * between rows and Enter opens the entry.
 */
export function TrainingTable({
  rows,
  people,
  today,
  selfStudy,
  workspace = 'research',
  grouped = true
}: {
  rows: TrainingIndexRow[]
  people: Person[]
  today: string
  /** Minutes tracked on each training's task, so a duration is the training's total. */
  selfStudy?: SelfStudy
  /** Life's log has no type or skills columns (they are Inkpath's). */
  workspace?: TrainingWorkspace
  /** Upcoming / Earlier headers: only while the list is sorted by date, newest first. */
  grouped?: boolean
}): React.JSX.Element {
  const research = workspace === 'research'
  const navigate = useNavigate()
  const { ordered, groups } = layoutRows(rows, grouped, (row) => isUpcoming(row, today, clockNow()))
  const columns = research ? 7 : 6
  const { tableProps, rowProps } = useRowNavigation(
    ordered.length,
    (index) => void navigate(entryRoute(ordered[index].id, workspace))
  )

  return (
    <div className={shared.wrap}>
      <table className={shared.table} aria-label="Training" {...tableProps}>
        <colgroup>
          <col style={{ width: WIDTHS.date }} />
          <col style={{ width: WIDTHS.time }} />
          <col style={{ width: WIDTHS.duration }} />
          <col style={{ width: WIDTHS.series }} />
          <col />
          {research && <col style={{ width: WIDTHS.skills }} />}
          <col style={{ width: WIDTHS.leads }} />
        </colgroup>
        <thead>
          <tr>
            {(research
              ? ['Date', 'Time', 'Duration', 'Series', 'Title', 'Skills', 'Leads']
              : ['Date', 'Time', 'Duration', 'Series', 'Title', 'Leads']
            ).map((label) => (
              <th key={label} className={shared.th} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              {group.label && <GroupRow label={group.label} colSpan={columns} />}
              {group.rows.map((row, offset) => {
                const index = group.start + offset
                const parts = entryParts(row, selfStudy)
                const title = row.title || 'Untitled'
                return (
                  <tr
                    key={`${row.workspace}/${row.id}`}
                    className={shared.row}
                    {...rowProps(index)}
                    onClick={() => void navigate(entryRoute(row.id, workspace))}
                  >
                    <td className={shared.nums}>
                      <CutText>
                        <Link
                          className={shared.link}
                          tabIndex={-1}
                          to={entryRoute(row.id, workspace)}
                          // The row handles the click; the link is for the keyboard and for assistive technology.
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.date ? formatDate(row.date) : 'No date'}
                        </Link>
                      </CutText>
                    </td>
                    <td className={shared.nums}>
                      <CutText>{formatTimeRange(row.start, row.end)}</CutText>
                    </td>
                    <td className={shared.nums}>
                      <CutText>
                        {parts === null ? '—' : durationWithStudy(parts.training, parts.selfStudy)}
                      </CutText>
                    </td>
                    <td>
                      <CutText>{row.series || '—'}</CutText>
                    </td>
                    <td>
                      <div className={styles.titleLine}>
                        <Tooltip text={title} whenCut>
                          <span className={styles.titleText}>{title}</span>
                        </Tooltip>
                        {row.folder && (
                          <Tooltip text="Linked folder">
                            <span className={styles.mark}>
                              <Folder
                                size={13}
                                strokeWidth={1.75}
                                aria-label="Has a linked folder"
                              />
                            </span>
                          </Tooltip>
                        )}
                        {row.hasNotes && (
                          <Tooltip text="Has notes">
                            <span className={styles.mark}>
                              <FileText size={13} strokeWidth={1.75} aria-label="Has notes" />
                            </span>
                          </Tooltip>
                        )}
                        {hasSummary(row) && (
                          <Tooltip text="Summary">
                            <span className={styles.mark}>
                              <TextAlignStart
                                size={13}
                                strokeWidth={1.75}
                                aria-label="Has a summary"
                              />
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    {research && (
                      <td className={shared.skills}>
                        <SkillChips skills={row.skills} limit={1} />
                      </td>
                    )}
                    <td>
                      <InitialsChips
                        names={row.leads}
                        initials={(name) => initialsFor(name, people)}
                      />
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
