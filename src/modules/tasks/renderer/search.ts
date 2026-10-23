import { snippet, type SearchHit } from '@shared/search'
import { passesFilters, searchNeedles, textMatches, type SearchRequest } from '@shared/search-query'
import { fold } from '@shared/text'
import { formatDue, listLabel, taskLine } from '../shared/query'
import { taskMatches } from '../shared/search-filters'
import type { Task, TaskWorkspace } from '../shared/types'
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
  request: SearchRequest,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const { today } = request
  const needles = searchNeedles(request)
  const byUid = new Map(tasks.map((t) => [t.uid, t]))
  return tasks
    .filter((t) => textMatches(haystack(t), request))
    .filter((t) => passesFilters(request.filters, (f) => taskMatches(t, byUid, f, today)))
    .sort((a, b) => {
      const done = Number(a.status === 'done') - Number(b.status === 'done')
      if (done) return done
      if (a.due !== b.due)
        return a.due === null ? 1 : b.due === null ? -1 : a.due.localeCompare(b.due)
      return a.title.localeCompare(b.title)
    })
    .slice(0, limit)
    .map((t) => {
      const inTitle = needles.every((n) => fold(t.title).includes(n))
      const parent = t.parentUid ? byUid.get(t.parentUid) : undefined
      const where = parent
        ? `Subtask of ${parent.title || 'Untitled'}`
        : listLabel(t.list, t.sublist)
      const details = taskLine(where, t.due && formatDue(t.due, today))
      return {
        key: t.uid,
        title: t.title || 'Untitled',
        detail: (!inTitle && snippet(t.description, needles)) || details,
        route: taskRoute(t.workspace, t.uid)
      }
    })
}

export function searchTasks(
  workspace: TaskWorkspace
): (request: SearchRequest, limit?: number) => Promise<SearchHit[]> {
  return async (request, limit) => taskHits(await window.api.tasks.list(workspace), request, limit)
}
