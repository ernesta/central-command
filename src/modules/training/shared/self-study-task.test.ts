import { describe, expect, it } from 'vitest'
import type { Task } from '../../tasks/shared/types'
import {
  planSelfStudyTask,
  type SelfStudyNote,
  selfStudyParentFor,
  selfStudyTitle
} from './self-study-task'

const task = (uid: string, title: string, over: Partial<Task> = {}): Task => ({
  uid,
  workspace: 'research',
  title,
  description: '',
  status: 'doing',
  priority: 'normal',
  due: null,
  completedAt: null,
  list: 'Training',
  sublist: '',
  parentUid: null,
  position: 0,
  recurrence: null,
  seriesUid: null,
  earlierMinutes: 0,
  sourceId: null,
  tags: [],
  createdAt: '',
  updatedAt: '',
  ...over
})

const seriesTask = task('p1', 'PS5210 self-study')
const mine = task('s1', 'Plotly self-study', { list: '', parentUid: 'p1' })
const note = (over: Partial<SelfStudyNote> = {}): SelfStudyNote => ({
  selfStudy: 's1',
  series: 'PS5210',
  title: 'Plotly',
  ...over
})

describe('selfStudyParentFor', () => {
  it('finds the open top-level `<series> self-study` task, ignoring case, else says what to create', () => {
    expect(selfStudyParentFor('ps5210 ', [seriesTask])).toEqual({ uid: 'p1' })
    expect(selfStudyParentFor('PS5210', [])).toEqual({
      title: 'PS5210 self-study',
      list: 'Training'
    })
  })
  it('does not take the series task itself, a done task or a subtask', () => {
    const plain = task('x', 'PS5210')
    const done = task('d', 'PS5210 self-study', { status: 'done' })
    const sub = task('u', 'PS5210 self-study', { list: '', parentUid: 'x' })
    expect(selfStudyParentFor('PS5210', [plain, done, sub])).toEqual({
      title: 'PS5210 self-study',
      list: 'Training'
    })
  })
  it('still finds a series task made with the first version’s middle dot, and renames its lecture task', () => {
    const old = task('p1', 'PS5210 · self-study')
    expect(selfStudyParentFor('PS5210', [old])).toEqual({ uid: 'p1' })
    const oldMine = task('s1', 'Plotly · self-study', { list: '', parentUid: 'p1' })
    expect(planSelfStudyTask(note(), [old, oldMine])).toEqual({
      kind: 'sync',
      uid: 's1',
      title: 'Plotly self-study'
    })
  })
  it('prefers the Training list', () => {
    const other = task('p2', 'PS5210 self-study', { list: 'Reading' })
    expect(selfStudyParentFor('PS5210', [other, seriesTask])).toEqual({ uid: 'p1' })
    expect(selfStudyParentFor('PS5210', [other])).toEqual({ uid: 'p2' })
  })
})

describe('planSelfStudyTask', () => {
  it('makes nothing by itself: no task and not asked is none', () => {
    expect(planSelfStudyTask(note({ selfStudy: '' }), [])).toEqual({ kind: 'none' })
    expect(planSelfStudyTask(note({ selfStudy: '' }), [seriesTask])).toEqual({ kind: 'none' })
  })

  it('when asked, makes the subtask under the series task that exists', () => {
    expect(planSelfStudyTask(note({ selfStudy: '' }), [seriesTask], true)).toEqual({
      kind: 'create',
      title: 'Plotly self-study',
      parent: { uid: 'p1' }
    })
  })

  it('when asked, says the series task is to be made when there is none', () => {
    expect(planSelfStudyTask(note({ selfStudy: '' }), [], true)).toEqual({
      kind: 'create',
      title: 'Plotly self-study',
      parent: { title: 'PS5210 self-study', list: 'Training' }
    })
  })

  it('when asked with no series, makes a top-level task of its own', () => {
    expect(planSelfStudyTask(note({ selfStudy: '', series: null }), [], true)).toEqual({
      kind: 'create',
      title: 'Plotly self-study',
      parent: null
    })
    expect(planSelfStudyTask(note({ selfStudy: '', series: '  ', title: '' }), [], true)).toEqual({
      kind: 'create',
      title: 'Untitled self-study',
      parent: null
    })
  })

  it('makes it again, silently, when the task was deleted and time is put on it', () => {
    expect(planSelfStudyTask(note({ selfStudy: 'gone' }), [seriesTask], true)).toMatchObject({
      kind: 'create',
      parent: { uid: 'p1' }
    })
    expect(planSelfStudyTask(note({ selfStudy: 'gone' }), [seriesTask])).toEqual({ kind: 'none' })
  })

  it('is in step already: nothing to do', () => {
    expect(planSelfStudyTask(note(), [seriesTask, mine])).toEqual({ kind: 'none' })
    expect(planSelfStudyTask(note(), [seriesTask, mine], true)).toEqual({ kind: 'none' })
  })

  it('follows a renamed title', () => {
    expect(planSelfStudyTask(note({ title: 'Plotly 2' }), [seriesTask, mine])).toEqual({
      kind: 'sync',
      uid: 's1',
      title: 'Plotly 2 self-study'
    })
  })

  it('does not rename to an empty title, and keeps the name while the title is cleared', () => {
    expect(planSelfStudyTask(note({ title: '  ' }), [seriesTask, mine])).toEqual({ kind: 'none' })
  })

  it('follows a changed series: moves under the other series task, found or to make', () => {
    expect(planSelfStudyTask(note({ series: 'PS6000' }), [seriesTask, mine])).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: { title: 'PS6000 self-study', list: 'Training' }
    })
    const other = task('p2', 'PS6000 self-study')
    expect(planSelfStudyTask(note({ series: 'PS6000' }), [seriesTask, other, mine])).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: { uid: 'p2' }
    })
  })

  it('a cleared series takes the subtask out to top level', () => {
    expect(planSelfStudyTask(note({ series: null }), [seriesTask, mine])).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: null
    })
  })

  it('a top-level task of its own moves under the series task once a series is added', () => {
    const alone = task('s1', 'Plotly self-study')
    expect(planSelfStudyTask(note(), [seriesTask, alone])).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: { uid: 'p1' }
    })
    expect(planSelfStudyTask(note({ series: null }), [alone])).toEqual({ kind: 'none' })
  })

  it('never takes the note itself as its own series task', () => {
    const alone = task('s1', 'PS5210 self-study')
    expect(planSelfStudyTask(note({ title: 'PS5210' }), [alone])).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: { title: 'PS5210 self-study', list: 'Training' }
    })
  })

  it('never renames or moves a task that is not the note’s own', () => {
    // a subtask under something that is not a self-study series task
    const parent = task('p9', 'Taxes')
    const stray = task('s1', 'Anything', { list: '', parentUid: 'p9' })
    expect(planSelfStudyTask(note({ title: 'Other' }), [parent, stray])).toEqual({ kind: 'none' })
    // a top-level task outside Training, or with subtasks of its own
    const elsewhere = task('s1', 'Anything', { list: 'Work' })
    expect(planSelfStudyTask(note({ title: 'Other' }), [elsewhere])).toEqual({ kind: 'none' })
    const busy = task('s1', 'Anything')
    const child = task('c', 'Child', { list: '', parentUid: 's1' })
    expect(planSelfStudyTask(note({ title: 'Other' }), [busy, child])).toEqual({ kind: 'none' })
  })

  it('another note’s subtask is left alone: only the uid in the note is ever planned', () => {
    const neighbour = task('s2', 'Dash self-study', { list: '', parentUid: 'p1' })
    const plan = planSelfStudyTask(note({ title: 'Plotly 2' }), [seriesTask, mine, neighbour])
    expect(plan).toMatchObject({ kind: 'sync', uid: 's1' })
  })

  it('the title helper trims', () => {
    expect(selfStudyTitle('  PS5210 ')).toBe('PS5210 self-study')
  })
})
