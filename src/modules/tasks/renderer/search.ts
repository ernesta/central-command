import { snippet, type SearchHit } from '@shared/search'
import { passesFilters, searchNeedles, textMatches, type SearchRequest } from '@shared/search-query'
import { fold } from '@shared/text'
import { visibleTasks } from '../shared/session-lock'
import { daysLate } from '../shared/late'
import { studyLabel } from '../shared/study-label'
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
      // A subtask has no list of its own: it sits in its parent's.
      const list =
        parent && !t.list ? listLabel(parent.list, parent.sublist) : listLabel(t.list, t.sublist)
      const rest = t.due ? formatDue(t.due, today) : ''
      const details = taskLine(list, rest)
      const marker = parent && t.ownKind !== 'self-study' ? parent.title || 'Untitled' : null
      return {
        key: t.uid,
        title: studyLabel(t, parent),
        detail: (!inTitle && snippet(t.description, needles)) || details,
        subtask: marker === null ? undefined : { parent: marker, list, rest },
        late: t.status === 'done' ? undefined : daysLate(t.due, today) || undefined,
        route: taskRoute(t.workspace, t.uid)
      }
    })
}

export function searchTasks(
  workspace: TaskWorkspace
): (request: SearchRequest, limit?: number) => Promise<SearchHit[]> {
  return async (request, limit) =>
    taskHits(visibleTasks(await window.api.tasks.list(workspace)), request, limit)
}
