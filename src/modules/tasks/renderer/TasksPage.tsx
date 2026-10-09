import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { FilterRow } from '@renderer/components/FilterRow'
import { SearchInput } from '@renderer/components/SearchInput'
import { Segmented } from '@renderer/components/Segmented'
import { Select } from '@renderer/components/Select'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import {
  DEFAULT_TASKS_QUERY,
  listChoices,
  listLabel,
  listValue,
  parseListValue,
  queryTasks,
  reconcileQuery,
  tagsIn,
  viewCounts,
  type SortKey,
  type TasksQuery
} from '../shared/query'
import { TASK_PRIORITIES } from '../shared/types'
import type { TaskView } from '../shared/views'
import { AddBar } from './AddBar'
import { NewTaskButton } from './NewTaskButton'
import { PRIORITY_LABELS } from './task-labels'
import { useWorkClients } from './useWorkClients'
import { TasksTable } from './TasksTable'
import { tasksBase, todayIso, useTasksWorkspace } from './tasks-paths'
import { useTaskTime } from './useTaskTime'
import { useTasksList } from './useTasksList'
import { useTasksView } from './useTasksView'
import styles from './TasksPage.module.css'

/** How many rows are drawn before "Show all" (Done holds hundreds). */
const PAGE_ROWS = 50

/**
 * All tasks: the filter row, a Segmented Open / Backlog / Done, the add bar and the table. A list's page is this page with the
 * list filter set (a card on the landing opens it that way) and is titled with the list.
 */
export function TasksPage(): React.JSX.Element {
  const workspace = useTasksWorkspace()
  const { rows } = useTasksList(workspace)
  const { tracked, running } = useTaskTime(workspace)
  const [params] = useSearchParams()
  // A card or link opens the page already filtered (for this visit only, the other filters cleared so that is what you see).
  const listParam = params.get('list')
  const viewParam = params.get('view')
  const { query: saved, setQuery } = useTasksView(
    workspace,
    listParam !== null || viewParam !== null
      ? {
          ...DEFAULT_TASKS_QUERY,
          list: listParam ?? '',
          view: viewParam === 'backlog' || viewParam === 'done' ? viewParam : 'open'
        }
      : undefined
  )
  const [showAll, setShowAll] = useState(false)
  const today = todayIso()
  const all = rows ?? []
  const clients = useWorkClients(workspace)
  const query: TasksQuery = rows === null ? saved : reconcileQuery(saved, all, clients)
  const set = (patch: Partial<TasksQuery>): void => {
    setShowAll(false)
    setQuery(patch)
  }

  const visible = queryTasks(all, query, tracked)
  const counts = viewCounts(all, query)
  // Open also shows its undated to-dos under it, in a section of their own, so they are not missed.
  const backlog =
    query.view === 'open' ? queryTasks(all, { ...query, view: 'backlog' }, tracked) : []
  const shown = showAll ? visible : visible.slice(0, PAGE_ROWS)
  const filtersActive =
    query.search.trim() !== '' || query.list !== '' || query.priority !== 'all' || query.tag !== ''
  const { list: titleList, sublist: titleSub } = parseListValue(query.list)
  const heading = query.list ? listLabel(titleList, titleSub) : 'All tasks'
  useDocumentTitle(heading)

  const onSort = (key: SortKey): void => {
    if (query.sort !== key) set({ sort: key, dir: 'asc' })
    else if (query.dir === 'asc') set({ dir: 'desc' })
    else set({ sort: 'default', dir: 'asc' })
  }

  let content: React.ReactNode = null
  if (rows === null) content = null
  else if (all.length === 0) {
    content = <EmptyState heading="No tasks yet" message="Add one above." />
  } else if (visible.length === 0 && query.list && !all.some((r) => r.task.list === titleList)) {
    // A client's list that holds no task yet (the filter is the list alone, so there is nothing to clear).
    content = <EmptyState heading="No tasks yet" message="Add one above." />
  } else if (visible.length === 0 && backlog.length === 0) {
    content = (
      <EmptyState heading="No matching tasks" message="Try a different search or filter.">
        {filtersActive && (
          <Button onClick={() => setQuery({ ...DEFAULT_TASKS_QUERY, view: query.view })}>
            Clear filters
          </Button>
        )}
      </EmptyState>
    )
  } else {
    content = (
      <>
        {visible.length > 0 && (
          <TasksTable
            rows={shown.map((r) => ({ ...r, nested: [] }))}
            workspace={workspace}
            today={today}
            label="Tasks"
            tracked={tracked}
            running={running}
            sort={{ key: query.sort, dir: query.dir, onSort }}
          />
        )}
        {visible.length > shown.length && (
          <p className={styles.more}>
            <span>
              Showing {shown.length} of {visible.length}
            </span>
            <button type="button" className={styles.showAll} onClick={() => setShowAll(true)}>
              Show all
            </button>
          </p>
        )}
        {backlog.length > 0 && (
          <section className={styles.backlog} aria-labelledby="backlog-heading">
            <h2 id="backlog-heading" className={styles.sectionHeading}>
              Backlog {backlog.length}
            </h2>
            <TasksTable
              rows={backlog.map((r) => ({ ...r, nested: [] }))}
              workspace={workspace}
              today={today}
              label="Backlog"
              tracked={tracked}
              running={running}
              sort={{ key: query.sort, dir: query.dir, onSort }}
            />
          </section>
        )}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={tasksBase(workspace)}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Tasks
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>{heading}</h1>
        <div className={styles.actions}>
          <NewTaskButton list={query.list} />
        </div>
      </header>

      <FilterRow>
        <SearchInput
          label="Search tasks"
          value={query.search}
          onChange={(search) => set({ search })}
        />
        <Select
          label="Filter by list"
          value={query.list}
          options={[
            { value: '', label: 'All lists' },
            ...listChoices(all, clients).map((c) => ({
              value: listValue(c.list, c.sublist),
              label: c.sublist ? `${c.list} › ${c.sublist}` : c.list
            }))
          ]}
          onChange={(list) => set({ list })}
        />
        <Select
          label="Filter by priority"
          value={query.priority}
          options={[
            { value: 'all', label: 'Any priority' },
            ...TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))
          ]}
          onChange={(priority) => set({ priority })}
        />
        <Select
          label="Filter by tag"
          value={query.tag}
          options={[
            { value: '', label: 'Any tag' },
            ...tagsIn(all).map((t) => ({ value: t, label: t }))
          ]}
          onChange={(tag) => set({ tag })}
        />
        <Segmented<TaskView>
          label="Show"
          value={query.view}
          options={[
            { value: 'open', label: `Open ${counts.open}` },
            { value: 'backlog', label: `Backlog ${counts.backlog}` },
            { value: 'done', label: `Done ${counts.done}` }
          ]}
          onChange={(view) => set({ view })}
        />
      </FilterRow>

      {rows !== null && (
        <AddBar workspace={workspace} rows={all} today={today} listFilter={query.list} />
      )}

      <div className={styles.content}>{content}</div>
    </div>
  )
}
