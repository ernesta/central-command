import { describe, expect, it } from 'vitest'
import type { CreateTaskInput } from '../../tasks/shared/api'
import type { Task } from '../../tasks/shared/types'
import { planSelfStudyTask, type SelfStudyNote } from '../shared/self-study-task'
import {
  draftSelfStudyTask,
  makeSelfStudyTask,
  syncSelfStudyTask,
  type SelfStudyTasksApi
} from './self-study-sync'

const blank = (uid: string, title: string, over: Partial<Task> = {}): Task => ({
  ...draftSelfStudyTask({ selfStudy: '', series: null, title: '' }),
  uid,
  title,
  ...over
})

/** A tiny in-memory Tasks API: creating and updating act on a list, deleting removes. */
function fake(initial: Task[]): { api: SelfStudyTasksApi; tasks: Task[]; deleted: string[] } {
  const state = { tasks: [...initial], deleted: [] as string[], n: 0 }
  const api: SelfStudyTasksApi = {
    list: async () => [...state.tasks],
    create: async (input: CreateTaskInput) => {
      const parent = state.tasks.find((t) => t.uid === input.parentUid)
      const task = blank(`n${++state.n}`, input.title, {
        list: parent ? '' : (input.list ?? ''),
        parentUid: input.parentUid ?? null
      })
      state.tasks.push(task)
      return task
    },
    update: async (uid, changes) => {
      const i = state.tasks.findIndex((t) => t.uid === uid)
      state.tasks[i] = { ...state.tasks[i], ...changes } as Task
      return state.tasks[i]
    },
    delete: async (uid) => {
      state.deleted.push(uid)
      state.tasks = state.tasks.filter((t) => t.uid !== uid && t.parentUid !== uid)
    }
  }
  return {
    api,
    get tasks() {
      return state.tasks
    },
    deleted: state.deleted
  }
}

const note: SelfStudyNote = { selfStudy: '', series: 'PS5210', title: 'Plotly' }

describe('makeSelfStudyTask', () => {
  it('makes the series task and the subtask under it when neither exists', async () => {
    const f = fake([])
    const made = new Set<string>()
    const task = await makeSelfStudyTask(f.api, note, made)
    expect(f.tasks.map((t) => [t.title, t.parentUid ? 'sub' : t.list])).toEqual([
      ['PS5210 · self-study', 'Training'],
      ['Plotly · self-study', 'sub']
    ])
    expect(task.parentUid).toBe(f.tasks[0].uid)
    expect(task.status).toBe('doing')
    expect(made.has(f.tasks[0].uid)).toBe(true)
  })

  it('puts a second lecture under the same series task', async () => {
    const f = fake([])
    const made = new Set<string>()
    await makeSelfStudyTask(f.api, note, made)
    const second = await makeSelfStudyTask(f.api, { ...note, title: 'Dash' }, made)
    expect(f.tasks).toHaveLength(3)
    expect(second.parentUid).toBe(f.tasks[0].uid)
  })

  it('makes a top-level task in Training for a lecture with no series', async () => {
    const f = fake([])
    const task = await makeSelfStudyTask(f.api, { ...note, series: null }, new Set())
    expect(task).toMatchObject({ title: 'Plotly · self-study', list: 'Training', parentUid: null })
  })

  it('returns a task that exists as it is, and makes a deleted one again, silently', async () => {
    const f = fake([])
    const first = await makeSelfStudyTask(f.api, note, new Set())
    const again = await makeSelfStudyTask(f.api, { ...note, selfStudy: first.uid }, new Set())
    expect(again.uid).toBe(first.uid)
    expect(f.tasks).toHaveLength(2)
    await f.api.delete(first.uid)
    const remade = await makeSelfStudyTask(f.api, { ...note, selfStudy: first.uid }, new Set())
    expect(remade.uid).not.toBe(first.uid)
    expect(remade.parentUid).toBe(f.tasks[0].uid)
  })
})

describe('syncSelfStudyTask', () => {
  const setup = async (): Promise<ReturnType<typeof fake> & { uid: string; made: Set<string> }> => {
    const f = fake([])
    const made = new Set<string>()
    const task = await makeSelfStudyTask(f.api, note, made)
    return Object.assign(f, { uid: task.uid, made })
  }
  const run = async (
    f: Awaited<ReturnType<typeof setup>>,
    over: Partial<SelfStudyNote>
  ): Promise<void> => {
    const plan = planSelfStudyTask({ ...note, selfStudy: f.uid, ...over }, f.tasks)
    if (plan.kind === 'sync') await syncSelfStudyTask(f.api, plan, f.tasks, f.made)
  }

  it('follows a renamed title', async () => {
    const f = await setup()
    await run(f, { title: 'Plotly 2' })
    expect(f.tasks.find((t) => t.uid === f.uid)?.title).toBe('Plotly 2 · self-study')
  })

  it('moves under another series and trashes the series task it made and left empty', async () => {
    const f = await setup()
    const old = f.tasks[0].uid
    await run(f, { series: 'PS6000' })
    const moved = f.tasks.find((t) => t.uid === f.uid)
    expect(f.tasks.find((t) => t.uid === moved?.parentUid)?.title).toBe('PS6000 · self-study')
    expect(f.deleted).toEqual([old])
  })

  it('keeps a series task it did not make, and one that still has other lectures', async () => {
    const f = await setup()
    const mine = f.tasks[0].uid
    await makeSelfStudyTask(f.api, { ...note, title: 'Dash' }, f.made)
    await run(f, { series: 'PS6000' })
    expect(f.deleted).toEqual([])
    expect(f.tasks.some((t) => t.uid === mine)).toBe(true)
    const userMade = fake([blank('u1', 'PS5210 · self-study')])
    const made = new Set<string>()
    const sub = await makeSelfStudyTask(userMade.api, note, made)
    const plan = planSelfStudyTask({ ...note, selfStudy: sub.uid, series: null }, userMade.tasks)
    if (plan.kind === 'sync') await syncSelfStudyTask(userMade.api, plan, userMade.tasks, made)
    expect(userMade.deleted).toEqual([])
  })

  it('a cleared series takes the task out to top level in Training', async () => {
    const f = await setup()
    await run(f, { series: null })
    expect(f.tasks.find((t) => t.uid === f.uid)).toMatchObject({
      parentUid: null,
      list: 'Training'
    })
  })
})
