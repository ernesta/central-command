import { ListTodo } from 'lucide-react'
import { fold } from '@shared/text'
import { nameFirst } from '@shared/search'
import type { EntityProvider } from '@renderer/entities/registry'
import { listLabel } from '../shared/query'
import type { Task } from '../shared/types'
import { allTasks } from './task-cache'
import { taskRoute } from './tasks-paths'

const WORKSPACE_LABEL = { research: 'Research', work: 'Work' } as const

function detailOf(task: Task, parent: Task | undefined): string {
  const where = parent
    ? `Subtask of ${parent.title || 'Untitled'}`
    : listLabel(task.list, task.sublist)
  return `${where} · ${WORKSPACE_LABEL[task.workspace]}`
}

/** Tasks a note can mention, in either workspace, by their `uid`. Tasks not done come first. */
export const taskEntities: EntityProvider = {
  kind: 'task',
  heading: 'Tasks',
  noun: 'task',
  icon: ListTodo,
  async search(query, limit, self) {
    const tasks = await allTasks()
    const byUid = new Map(tasks.map((t) => [t.uid, t]))
    const terms = fold(query).split(/\s+/).filter(Boolean)
    const matching = tasks
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
        detail: detailOf(t, t.parentUid ? byUid.get(t.parentUid) : undefined),
        label: t.title || 'Untitled',
        prepare: async () => ({ kind: 'task' as const, key: t.uid })
      }))
  },
  async resolve(key) {
    const find = (list: Task[]): Task | undefined => list.find((t) => t.uid === key)
    const tasks = await allTasks()
    // A task made a moment ago is not in the cached list yet.
    const task = find(tasks) ?? find(await allTasks(true))
    if (!task) return null
    const parent = task.parentUid ? tasks.find((t) => t.uid === task.parentUid) : undefined
    return {
      title: task.title || 'Untitled',
      detail: detailOf(task, parent),
      route: taskRoute(task.workspace, task.uid)
    }
  }
}
