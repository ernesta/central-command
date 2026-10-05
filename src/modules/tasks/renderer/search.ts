import { searchTerms, snippet, type SearchHit } from '@shared/search'
import { fold } from '@shared/text'
import { formatDue, listLabel } from '../shared/query'
import type { Task, TaskWorkspace } from '../shared/types'
import { todayIso } from '@shared/time'
import { taskRoute } from './tasks-paths'

const DEFAULT_LIMIT = 6

function haystack(task: Task): string {
  return fold(
    [task.title, ...task.tags, listLabel(task.list, task.sublist), task.description].join('\n')
  )
}

/** The tasks that match: open ones first (the soonest due first), then done ones; the part of the description that matched, else the list and date. */
export function taskHits(
  tasks: readonly Task[],
  query: string,
  limit = DEFAULT_LIMIT,
  today = todayIso()
): SearchHit[] {
  const terms = searchTerms(query)
  if (terms.length === 0) return []
  const byUid = new Map(tasks.map((t) => [t.uid, t]))
  return tasks
    .filter((t) => terms.every((term) => haystack(t).includes(term)))
    .sort((a, b) => {
      const done = Number(a.status === 'done') - Number(b.status === 'done')
      if (done) return done
      if (a.due !== b.due)
        return a.due === null ? 1 : b.due === null ? -1 : a.due.localeCompare(b.due)
      return a.title.localeCompare(b.title)
    })
    .slice(0, limit)
    .map((t) => {
      const inTitle = terms.every((term) => fold(t.title).includes(term))
      const parent = t.parentUid ? byUid.get(t.parentUid) : undefined
      const where = parent
        ? `Subtask of ${parent.title || 'Untitled'}`
        : listLabel(t.list, t.sublist)
      const details = [where, t.due ? formatDue(t.due, today) : ''].filter(Boolean).join(' · ')
      return {
        key: t.uid,
        title: t.title || 'Untitled',
        detail: (!inTitle && snippet(t.description, terms)) || details,
        route: taskRoute(t.workspace, t.uid)
      }
    })
}

export function searchTasks(
  workspace: TaskWorkspace
): (query: string, limit?: number) => Promise<SearchHit[]> {
  return async (query, limit) => taskHits(await window.api.tasks.list(workspace), query, limit)
}
