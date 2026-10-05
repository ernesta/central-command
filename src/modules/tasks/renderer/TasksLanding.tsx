import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  AllLink,
  LandingHeader,
  LandingPage,
  LandingSection,
  SeeAllLink,
  SeriesCards
} from '@renderer/components/Landing'
import { ArrowRight } from 'lucide-react'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { listValue } from '../shared/query'
import { isBacklog, landingSections, listSummaries, type SectionRow } from '../shared/views'
import { AddBar } from './AddBar'
import { NewTaskButton } from './NewTaskButton'
import { showTaskToast } from './task-toast'
import { TasksTable } from './TasksTable'
import { tasksAllRoute, todayIso, useTasksWorkspace } from './tasks-paths'
import { useTaskTime } from './useTaskTime'
import { useTasksList } from './useTasksList'
import styles from './TasksLanding.module.css'

/** How many rows a long section shows before "Show all". */
const SECTION_LIMIT = 5

/** The Tasks landing page: what is due today, in progress, overdue and coming up, then the lists. */
export function TasksLanding(): React.JSX.Element {
  const workspace = useTasksWorkspace()
  const { rows } = useTasksList(workspace)
  const { tracked, running } = useTaskTime(workspace)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [moving, setMoving] = useState<'today' | 'backlog' | null>(null)
  const today = todayIso()

  const all = rows ?? []
  const sections = landingSections(all, today)
  const lists = listSummaries(all, today)
  const backlog = all.filter(isBacklog).length

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
    id: 'today' | 'doing' | 'overdue' | 'upcoming',
    label: string,
    empty: string,
    aside?: React.ReactNode,
    limit = false
  ): React.JSX.Element => {
    const list = sections[id]
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

  const moveOverdue = async (to: 'today' | 'backlog'): Promise<void> => {
    try {
      const uids = sections.overdue.map((r) => r.task.uid)
      await window.api.tasks.setDue(uids, to === 'today' ? today : null)
    } catch (e) {
      showTaskToast(`Couldn’t move them: ${ipcErrorMessage(e)}`)
    } finally {
      setMoving(null)
    }
  }

  return (
    <LandingPage>
      <LandingHeader
        backTo={workspace === 'research' ? '/research' : '/work'}
        backLabel={workspace === 'research' ? 'Research' : 'Work'}
        title="Tasks"
        actions={
          <>
            <AllLink to={tasksAllRoute(workspace)}>
              All tasks
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden style={{ marginLeft: 6 }} />
            </AllLink>
            <NewTaskButton />
          </>
        }
      />

      {rows !== null && (
        <>
          <AddBar workspace={workspace} rows={all} today={today} />
          {section('today', 'Due today', 'Nothing is due today.')}
          {section('doing', 'In progress', 'Nothing in progress.', undefined, true)}
          {section(
            'overdue',
            'Overdue',
            'Nothing is overdue.',
            sections.overdue.length > 0 && (
              <span className={styles.asideButtons}>
                <button type="button" className={styles.quiet} onClick={() => setMoving('today')}>
                  Move to Today
                </button>
                <button type="button" className={styles.quiet} onClick={() => setMoving('backlog')}>
                  Move to Backlog
                </button>
              </span>
            ),
            true
          )}
          {section(
            'upcoming',
            'Upcoming',
            'Nothing in the next 14 days.',
            <span className={styles.muted}>Next 14 days</span>
          )}

          <LandingSection
            id="tasks-lists"
            label="Lists"
            aside={
              <SeeAllLink to={tasksAllRoute(workspace, { view: 'backlog' })}>
                Backlog {backlog}
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </SeeAllLink>
            }
          >
            {lists.length === 0 ? (
              <EmptyState heading="No tasks yet" message="Add one above." />
            ) : (
              <SeriesCards
                cards={lists.map((l) => ({
                  key: l.list,
                  to: tasksAllRoute(workspace, { list: listValue(l.list) }),
                  title: l.list,
                  line: `${l.open} open`,
                  extra:
                    [l.overdue > 0 ? `${l.overdue} overdue` : '', l.sublists.join(', ')]
                      .filter(Boolean)
                      .join(' · ') || undefined
                }))}
              />
            )}
          </LandingSection>
        </>
      )}

      {moving && (
        <Dialog
          title={moving === 'today' ? 'Move to Today' : 'Move to Backlog'}
          onCancel={() => setMoving(null)}
          actions={
            <>
              <Button autoFocus onClick={() => setMoving(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void moveOverdue(moving)}>
                Move
              </Button>
            </>
          }
        >
          {moving === 'today'
            ? `Make ${sections.overdue.length} overdue ${sections.overdue.length === 1 ? 'task' : 'tasks'} due today?`
            : `Clear the date of ${sections.overdue.length} overdue ${sections.overdue.length === 1 ? 'task' : 'tasks'}? They go to the Backlog.`}
        </Dialog>
      )}
    </LandingPage>
  )
}
