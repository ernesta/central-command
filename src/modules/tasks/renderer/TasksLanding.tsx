import { useState } from 'react'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  AllLink,
  LandingHeader,
  LandingPage,
  LandingSection,
  SeriesCards
} from '@renderer/components/Landing'
import { showToast } from '@renderer/components/toast-store'
import { pushUndo } from '@renderer/components/undo-store'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { listValue } from '../shared/query'
import { landingSections, listSummaries, type SectionRow } from '../shared/views'
import { AddBar } from './AddBar'
import { TasksTable } from './TasksTable'
import { tasksAllRoute, todayIso, useTasksWorkspace } from './tasks-paths'
import { useWorkClients } from './useWorkClients'
import { useTaskTime } from './useTaskTime'
import { useTasksList } from './useTasksList'
import styles from './TasksLanding.module.css'

/** How many rows a long section shows before "Show all". */
const SECTION_LIMIT = 5

/** The Tasks landing page: what is due today, overdue, coming up and in progress, then the lists. */
export function TasksLanding(): React.JSX.Element {
  const workspace = useTasksWorkspace()
  const { rows } = useTasksList(workspace)
  const { tracked, running } = useTaskTime(workspace)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const today = todayIso()

  const all = rows ?? []
  const sections = landingSections(all, today)
  const clients = useWorkClients(workspace)
  const summaries = listSummaries(all, today, clients)
  const lists = summaries.filter((l) => l.open > 0 || l.total === 0)
  const finished = summaries.filter((l) => l.open === 0 && l.total > 0)

  const limited = (id: string, list: SectionRow[]): SectionRow[] =>
    expanded.has(id) ? list : list.slice(0, SECTION_LIMIT)
  const more = (id: string, shown: number, total: number): React.ReactNode =>
    total > SECTION_LIMIT && (
      <p className={styles.more}>
        <span>{expanded.has(id) ? `Showing all ${total}` : `Showing ${shown} of ${total}`}</span>
        <button
          type="button"
          className={styles.showAll}
          onClick={() =>
            setExpanded((current) => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
        >
          {expanded.has(id) ? 'Show fewer' : 'Show all'}
        </button>
      </p>
    )

  const section = (
    id: 'today' | 'tomorrow' | 'doing' | 'overdue' | 'upcoming',
    label: string,
    empty: string,
    aside?: React.ReactNode,
    limit = false
  ): React.JSX.Element => {
    const list = sections[id]
    if (list.length === 0) return <></>
    const shown = limit ? limited(id, list) : list
    return (
      <LandingSection id={`tasks-${id}`} label={`${label} · ${list.length}`} aside={aside}>
        <TasksTable
          rows={shown}
          workspace={workspace}
          today={today}
          label={label}
          empty={empty}
          tracked={tracked}
          running={running}
        />
        {limit && more(id, shown.length, list.length)}
      </LandingSection>
    )
  }

  const moveOverdueToToday = async (): Promise<void> => {
    try {
      // Only what is overdue: a row can be here because of a subtask, and its own (later) date stays
      const moved = sections.overdue.flatMap((r) => [
        ...(r.task.due !== null && r.task.due < today ? [r.task] : []),
        ...r.nested
      ])
      await window.api.tasks.setDue(
        moved.map((t) => t.uid),
        today
      )
      pushUndo({
        label: 'move of the overdue tasks',
        undo: async () => {
          for (const t of moved) await window.api.tasks.setDue([t.uid], t.due)
        }
      })
    } catch (e) {
      showToast(`Couldn’t move them: ${ipcErrorMessage(e)}`)
    }
  }

  return (
    <LandingPage>
      <LandingHeader
        title="Tasks"
        actions={
          <>
            <AllLink to={tasksAllRoute(workspace, { view: 'open' })}>
              All tasks
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden style={{ marginLeft: 6 }} />
            </AllLink>
          </>
        }
      />

      {rows !== null && (
        <>
          <AddBar workspace={workspace} rows={all} today={today} />
          {section(
            'overdue',
            'Overdue',
            'Nothing is overdue.',
            <button
              type="button"
              className={styles.quiet}
              onClick={() => void moveOverdueToToday()}
            >
              Move to Today
            </button>,
            true
          )}
          {section('today', 'Due today', 'Nothing is due today.')}
          {section('tomorrow', 'Due tomorrow', 'Nothing is due tomorrow.')}
          {section(
            'upcoming',
            'Soon',
            'Nothing in the next 7 days.',
            <span className={styles.muted}>Next 7 days</span>
          )}
          {section('doing', 'In progress', 'Nothing in progress.', undefined, true)}

          <LandingSection id="tasks-lists" label="Lists">
            {summaries.length === 0 ? (
              <EmptyState heading="No tasks yet" message="Add one above." />
            ) : (
              <>
                <SeriesCards
                  cards={lists.map((l) => ({
                    key: l.list,
                    to: tasksAllRoute(workspace, { list: listValue(l.list) }),
                    title: l.list,
                    line: `${l.open} open`,
                    extra: l.overdue > 0 ? `${l.overdue} overdue` : undefined,
                    chips: l.sublists.map((s) => ({ label: s.name, count: s.open }))
                  }))}
                />
                {finished.length > 0 && (
                  <p className={styles.finished}>
                    <span className={styles.finishedLabel}>Nothing open</span>
                    {finished.map((l) => (
                      <Link
                        key={l.list}
                        className={styles.finishedLink}
                        to={tasksAllRoute(workspace, { list: listValue(l.list) })}
                      >
                        {l.list}
                        {l.sublists.length > 0 && (
                          <span className={styles.muted}>
                            {' '}
                            {l.sublists.length} {l.sublists.length === 1 ? 'sublist' : 'sublists'}
                          </span>
                        )}
                      </Link>
                    ))}
                  </p>
                )}
              </>
            )}
          </LandingSection>
        </>
      )}
    </LandingPage>
  )
}
