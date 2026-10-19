import type { TasksApi } from '../../tasks/shared/api'
import type { Task } from '../../tasks/shared/types'
import { strandedParent, TRAINING_LIST, type ParentTarget } from '../shared/training-task'
import {
  planSelfStudyTask,
  selfStudyTitle,
  type SelfStudyNote,
  type SelfStudyPlan
} from '../shared/self-study-task'

/** The slice of the Tasks API the self-study task needs. */
export type SelfStudyTasksApi = Pick<TasksApi, 'create' | 'update' | 'delete' | 'list'>

/** The series' self-study task: found, or made now (and remembered in `made`, in case the series was only typed halfway). */
async function parentUid(
  api: SelfStudyTasksApi,
  target: ParentTarget,
  made: Set<string>
): Promise<string> {
  if ('uid' in target) return target.uid
  const task = await api.create({ workspace: 'research', title: target.title, list: target.list })
  made.add(task.uid)
  return task.uid
}

/** A self-study task that is not made yet, for the buttons to show: Start and Add time make it when pressed (`uid` is ''). */
export function draftSelfStudyTask(note: SelfStudyNote): Task {
  return {
    uid: '',
    workspace: 'research',
    title: selfStudyTitle(note.title || 'Untitled'),
    description: '',
    status: 'doing',
    priority: 'normal',
    due: null,
    completedAt: null,
    list: TRAINING_LIST,
    sublist: '',
    parentUid: null,
    position: 0,
    recurrence: null,
    seriesUid: null,
    earlierMinutes: 0,
    sourceId: null,
    tags: [],
    ownKind: 'self-study',
    createdAt: '',
    updatedAt: ''
  }
}

/**
 * Makes the training's self-study task, because time is being put on it: the series' task if it is missing, then the subtask (or a
 * top-level task when the note has no series). Resolves with the task that now exists. One that exists already is returned as it is.
 */
export async function makeSelfStudyTask(
  api: SelfStudyTasksApi,
  note: SelfStudyNote,
  made: Set<string>
): Promise<Task> {
  const tasks = await api.list('research')
  const plan = planSelfStudyTask(note, tasks, true)
  if (plan.kind !== 'create') {
    const own = tasks.find((t) => t.uid === note.selfStudy)
    if (own) return own
    throw new Error('Could not make the self-study task')
  }
  return api.create({
    workspace: 'research',
    title: plan.title,
    status: 'doing',
    ownKind: 'self-study',
    ...(plan.due ? { due: plan.due } : {}),
    ...(plan.parent
      ? { parentUid: await parentUid(api, plan.parent, made) }
      : { list: TRAINING_LIST })
  })
}

/**
 * Brings an existing self-study task in step with the note (its title, and the series task it sits under). A series task this page
 * made that the training has now left, with nothing else in it, goes to the (restorable) trash.
 */
export async function syncSelfStudyTask(
  api: SelfStudyTasksApi,
  plan: Extract<SelfStudyPlan, { kind: 'sync' }>,
  tasks: readonly Task[],
  made: Set<string>
): Promise<void> {
  const left = tasks.find((t) => t.uid === plan.uid)?.parentUid ?? null
  await api.update(plan.uid, {
    ...(plan.title !== undefined ? { title: plan.title } : {}),
    ...(plan.due !== undefined ? { due: plan.due } : {}),
    ...(plan.parent
      ? { parentUid: await parentUid(api, plan.parent, made) }
      : plan.parent === null
        ? { parentUid: null, list: TRAINING_LIST }
        : {})
  })
  if (plan.parent !== undefined) {
    const stranded = strandedParent(made, left, await api.list('research'))
    if (stranded) await api.delete(stranded)
  }
}
