import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TEST_LOCALES, withLocale } from '@shared/with-locale.testing'
import { runMigrations } from '../../../main/db/migrate'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { tasksMigrations } from '../../tasks/main/migrations'
import { listTasks } from '../../tasks/main/repository'
import { TasksStore } from '../../tasks/main/tasks-store'
import type { CreateTrainingInput } from '../shared/api'
import type { TrainingRef } from '../shared/types'
import { trainingMigrations } from './migrations'
import { settleSelfStudyTasks } from './self-study-sweep'
import { TrainingStore } from './training-store'

let root: string
let db: Database.Database
let training: TrainingStore
let tasks: TasksStore

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-self-study-'))
  mkdirSync(join(root, 'research'))
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, [...tasksMigrations, ...meetingsMigrations, ...trainingMigrations])
  training = new TrainingStore({
    db,
    dirFor: (w) => join(root, w),
    trash: async () => undefined
  })
  tasks = new TasksStore(db)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const NOW = { date: '2026-10-19', time: '12:00' }
const sweep = (
  now = NOW,
  over: Partial<Parameters<typeof settleSelfStudyTasks>[0]> = {}
): Promise<boolean> =>
  settleSelfStudyTasks({
    db,
    tasks,
    training,
    now,
    nowMs: Date.now() + 3_600_000,
    ...over
  })

const entry = async (over: Partial<CreateTrainingInput> = {}): Promise<TrainingRef> =>
  (
    await training.create({
      workspace: 'research',
      date: '2026-10-21',
      title: 'Lecture 1',
      series: 'PS5210',
      task: 'auto',
      ...over
    })
  ).ref
const all = (): ReturnType<typeof listTasks> => listTasks(db, 'research')
const byTitle = (title: string): ReturnType<typeof listTasks> =>
  all().filter((t) => t.title === title)
const linked = async (ref: TrainingRef): Promise<string> =>
  (await training.read(ref)).meta.selfStudy

describe('settleSelfStudyTasks', () => {
  it.each(TEST_LOCALES)(
    '%s: makes the series task and the entry subtask, due on the entry date, and links the note',
    async (locale) => {
      await withLocale(locale, async () => {
        const ref = await entry()
        expect(await sweep()).toBe(true)
        const [parent] = byTitle('PS5210 self-study')
        const [sub] = byTitle('Lecture 1 self-study')
        expect(parent).toMatchObject({ list: 'Training', parentUid: null, ownKind: null })
        expect(sub).toMatchObject({
          parentUid: parent.uid,
          due: '2026-10-21',
          status: 'doing',
          ownKind: 'self-study'
        })
        expect(await linked(ref)).toBe(sub.uid)
        tasks.delete(sub.uid)
        tasks.delete(parent.uid)
      })
    }
  )

  it('is idempotent: a second run, and a third, make nothing', async () => {
    await entry()
    await sweep()
    expect(await sweep()).toBe(false)
    expect(await sweep()).toBe(false)
    expect(byTitle('Lecture 1 self-study')).toHaveLength(1)
    expect(byTitle('PS5210 self-study')).toHaveLength(1)
  })

  it('two entries of a series share one series task', async () => {
    await entry()
    await entry({ title: 'Lecture 2', date: '2026-10-28' })
    await sweep()
    const [parent] = byTitle('PS5210 self-study')
    expect(byTitle('PS5210 self-study')).toHaveLength(1)
    expect(
      all()
        .filter((t) => t.parentUid === parent.uid)
        .map((t) => t.title)
        .sort()
    ).toEqual(['Lecture 1 self-study', 'Lecture 2 self-study'])
  })

  it('an entry with no series gets a task of its own in Training', async () => {
    await entry({ series: null })
    await sweep()
    expect(byTitle('Lecture 1 self-study')[0]).toMatchObject({ list: 'Training', parentUid: null })
  })

  it('waits for a title and a date, and makes the task when the date is set', async () => {
    const dateless = await entry({ date: '' })
    await entry({ title: 'Untitled' })
    expect(await sweep()).toBe(false)
    expect(all()).toHaveLength(0)
    const file = await training.read(dateless)
    await training.save(dateless, { meta: { date: '2026-10-22' } }, file.note.hash)
    await sweep()
    expect(byTitle('Lecture 1 self-study')).toHaveLength(1)
  })

  it('follows a renamed entry, a changed series and a changed date', async () => {
    let ref = await entry()
    await sweep()
    const [sub] = byTitle('Lecture 1 self-study')
    let file = await training.read(ref)
    const renamed = await training.save(
      ref,
      { meta: { title: 'Lecture One', series: 'PS5300', date: '2026-10-23' } },
      file.note.hash
    )
    if (renamed.status === 'saved' && renamed.renamedTo) ref = { ...ref, id: renamed.renamedTo }
    await sweep()
    const moved = tasks.get(sub.uid)
    expect(moved).toMatchObject({ title: 'Lecture One self-study', due: '2026-10-23' })
    const newParent = byTitle('PS5300 self-study')[0]
    expect(moved?.parentUid).toBe(newParent.uid)
    expect(all().filter((t) => t.title.endsWith('self-study') && !t.parentUid)).toHaveLength(2)
    file = await training.read(ref)
    expect(file.meta.selfStudy).toBe(sub.uid)
  })

  it('leaves alone a note that names a task the user chose', async () => {
    const chosen = tasks.create({ workspace: 'research', title: 'My own task', list: 'Writing' })
    const ref = await entry()
    const file = await training.read(ref)
    await training.save(ref, { meta: { selfStudy: chosen.uid } }, file.note.hash)
    await sweep()
    expect(tasks.get(chosen.uid)).toMatchObject({ title: 'My own task', due: null, status: 'todo' })
    expect(byTitle('Lecture 1 self-study')).toHaveLength(0)
  })

  it('does not make a task again once the user has deleted it', async () => {
    await entry()
    await sweep()
    tasks.delete(byTitle('Lecture 1 self-study')[0].uid)
    expect(await sweep()).toBe(false)
    expect(byTitle('Lecture 1 self-study')).toHaveLength(0)
  })

  it('leaves a note edited a moment ago for the next run', async () => {
    await entry()
    expect(await sweep(NOW, { nowMs: Date.now() })).toBe(false)
    expect(all()).toHaveLength(0)
    expect(await sweep()).toBe(true)
  })

  it('makes nothing, and leaves nothing behind, when the note cannot be written', async () => {
    await entry()
    const failing = Object.create(training) as TrainingStore
    failing.save = async () => ({ status: 'conflict', disk: {} as never })
    expect(await sweep(NOW, { training: failing })).toBe(true)
    expect(all().filter((t) => t.title.endsWith('self-study'))).toHaveLength(0)
    expect(await sweep()).toBe(true)
    expect(byTitle('Lecture 1 self-study')).toHaveLength(1)
  })

  it('leaves every older entry alone: no task for one made before the app made tasks, however recent', async () => {
    const plain = await entry({ task: undefined })
    const mapped = tasks.create({ workspace: 'research', title: 'Mine', list: 'Training' })
    const chosen = await entry({ title: 'Lecture 2', task: mapped.uid })
    const file = await training.read(chosen)
    expect(file.meta.task).toBe(mapped.uid)
    expect(await sweep()).toBe(false)
    expect(all().filter((t) => t.title.endsWith('self-study'))).toHaveLength(0)
    expect((await training.read(plain)).meta.selfStudy).toBe('')
  })

  it('an entry whose own task is marked training is made one too', async () => {
    const own = tasks.create({
      workspace: 'research',
      title: 'Lecture 3',
      list: 'Training',
      ownKind: 'training'
    })
    await entry({ title: 'Lecture 3', task: own.uid })
    await sweep()
    expect(byTitle('Lecture 3 self-study')).toHaveLength(1)
  })

  describe('done a week after the entry ends', () => {
    it('not the minute before, done at the minute (an end time)', async () => {
      await entry({ date: '2026-10-10', start: '09:00', end: '11:00' })
      await sweep({ date: '2026-10-17', time: '10:59' })
      expect(byTitle('Lecture 1 self-study')[0].status).toBe('doing')
      await sweep({ date: '2026-10-17', time: '11:00' })
      expect(byTitle('Lecture 1 self-study')[0]).toMatchObject({
        status: 'done',
        due: '2026-10-10'
      })
    })

    it('not a day early, and done the day after', async () => {
      await entry({ date: '2026-10-10', start: '09:00', end: '11:00' })
      await sweep({ date: '2026-10-16', time: '23:59' })
      expect(byTitle('Lecture 1 self-study')[0].status).toBe('doing')
      await sweep({ date: '2026-10-18', time: '00:00' })
      expect(byTitle('Lecture 1 self-study')[0].status).toBe('done')
    })

    it('no end time: the end of the date’s day, a week on', async () => {
      await entry({ date: '2026-10-10' })
      await sweep({ date: '2026-10-17', time: '23:58' })
      expect(byTitle('Lecture 1 self-study')[0].status).toBe('doing')
      await sweep({ date: '2026-10-17', time: '23:59' })
      expect(byTitle('Lecture 1 self-study')[0].status).toBe('done')
    })

    it('an entry made in the app gets its task already done when its week is over', async () => {
      await entry({ date: '2026-08-01' })
      await sweep()
      expect(byTitle('Lecture 1 self-study')[0]).toMatchObject({
        status: 'done',
        due: '2026-08-01'
      })
    })

    it('a task the user reopens by hand stays open: the app closes it once', async () => {
      await entry({ date: '2026-10-10', start: '09:00', end: '11:00' })
      await sweep({ date: '2026-10-17', time: '10:00' })
      await sweep({ date: '2026-10-17', time: '11:00' })
      const uid = byTitle('Lecture 1 self-study')[0].uid
      expect(tasks.get(uid)?.status).toBe('done')
      tasks.setStatus(uid, 'doing')
      await sweep({ date: '2026-10-17', time: '11:05' })
      await sweep({ date: '2026-10-18', time: '09:00' })
      expect(tasks.get(uid)?.status).toBe('doing')
    })

    it('moving the date back past the week closes it; a done task is never reopened', async () => {
      const ref = await entry({ date: '2026-10-21' })
      await sweep()
      expect(byTitle('Lecture 1 self-study')[0].status).toBe('doing')
      const file = await training.read(ref)
      await training.save(ref, { meta: { date: '2026-10-01' } }, file.note.hash)
      await sweep()
      expect(byTitle('Lecture 1 self-study')[0]).toMatchObject({
        status: 'done',
        due: '2026-10-01'
      })
    })
  })
})

describe('the tracked time on a self-study task is kept', () => {
  it('a task the note already names is followed, not replaced', async () => {
    const ref = await entry()
    const parent = tasks.create({
      workspace: 'research',
      title: 'PS5210 self-study',
      list: 'Training'
    })
    const old = tasks.create({
      workspace: 'research',
      title: 'Lecture 1 self-study',
      parentUid: parent.uid,
      due: null
    })
    const file = await training.read(ref)
    await training.save(ref, { meta: { selfStudy: old.uid } }, file.note.hash)
    await sweep()
    expect(byTitle('Lecture 1 self-study')).toHaveLength(1)
    expect(tasks.get(old.uid)).toMatchObject({ due: '2026-10-21', parentUid: parent.uid })
  })
})
