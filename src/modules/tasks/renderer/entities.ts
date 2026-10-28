import { ListTodo } from 'lucide-react'
import { fold } from '@shared/text'
import { nameFirst } from '@shared/search'
import type { EntityProvider } from '@renderer/entities/registry'
import { taskLine } from '../shared/query'
import { hiddenTaskUids } from '../shared/session-lock'
import { subtaskParent } from '../shared/study-label'
import { detailOfTask } from '../shared/task-place'
import type { Task } from '../shared/types'
import { allTasks } from './task-cache'
import { taskRoute } from './tasks-paths'

const WORKSPACE_LABEL = { research: 'Research', work: 'Work' } as const

/**
 * The picker's second line, the shared one as plain text: `↳ Parent · list › sublist` for a subtask, the list for any other task.
 * The picker lists both workspaces at once (`allTasks`), so the workspace's name ends it.
 */
export function detailOf(task: Task, all: readonly Task[]): string {
  const parent = subtaskParent(task, all)
  const where = detailOfTask(task, all)
  return taskLine(
    parent === null ? where : `↳ ${parent || 'Untitled'} · ${where}`,
    WORKSPACE_LABEL[task.workspace]
  )
}

/** Tasks a note can mention, in either workspace, by their `uid`. Tasks not done come first. */
export const taskEntities: EntityProvider = {
  kind: 'task',
  heading: 'Tasks',
  noun: 'task',
  icon: ListTodo,
  async search(query, limit, self) {
    const tasks = await allTasks()
    const hidden = hiddenTaskUids(tasks)
    const terms = fold(query).split(/\s+/).filter(Boolean)
    const matching = tasks
      .filter((t) => !hidden.has(t.uid))
      .filter((t) => !(self?.kind === 'task' && self.id === t.uid))
      .filter((t) => {
        const text = fold(`${t.title} ${t.tags.join(' ')}`)
        return terms.every((term) => text.includes(term))
      })
      .sort(
        (a, b) =>
          Number(a.status === 'done') - Number(b.status === 'done') ||
          b.updatedAt.localeCompare(a.updatedAt)
      )
    return nameFirst(matching, (t) => t.title, query)
      .slice(0, limit)
      .map((t) => ({
        id: t.uid,
        title: t.title || 'Untitled',
        detail: detailOf(t, tasks),
        label: t.title || 'Untitled',
        prepare: async () => ({ kind: 'task' as const, key: t.uid })
      }))
  },
  async resolve(key) {
    const find = (list: Task[]): Task | undefined => list.find((t) => t.uid === key)
    let tasks = await allTasks()
    let task = find(tasks)
    if (!task) {
      // A task made a moment ago is not in the cached list yet.
      tasks = await allTasks(true)
      task = find(tasks)
    }
    // A meeting's or training's own task is never shown: a link to one is as good as a link to a deleted task.
    if (!task || hiddenTaskUids(tasks).has(task.uid)) return null
    return {
      label: task.title || 'Untitled',
      title: task.title || 'Untitled',
      detail: detailOf(task, tasks),
      route: taskRoute(task.workspace, task.uid)
    }
  }
}
