import { describe, expect, it } from 'vitest'
import type { Task } from '../../tasks/shared/types'
import { parentFor, planLectureTask } from './lecture-task'

const task = (uid: string, title: string, over: Partial<Task> = {}): Task => ({
  uid,
  workspace: 'research',
  title,
  description: '',
  status: 'todo',
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

const parent = task('p1', 'Intro to Python')
const lecture = task('s1', 'Session 3: Plotly', { list: '', parentUid: 'p1' })

describe('parentFor', () => {
  it('finds the open top-level task called the series, ignoring case, else says what to create', () => {
    expect(parentFor('intro to python ', [parent])).toEqual({ uid: 'p1' })
    expect(parentFor('Intro to Python', [])).toEqual({ title: 'Intro to Python', list: 'Training' })
  })
  it('prefers the Training list, skips done tasks and subtasks', () => {
    const other = task('p2', 'Intro to Python', { list: 'Reading' })
    expect(parentFor('Intro to Python', [other, parent])).toEqual({ uid: 'p1' })
    expect(parentFor('Intro to Python', [other])).toEqual({ uid: 'p2' })
    expect(parentFor('Intro to Python', [{ ...parent, status: 'done' }])).toEqual({
      title: 'Intro to Python',
      list: 'Training'
    })
    expect(parentFor('Session 3: Plotly', [lecture])).toEqual({
      title: 'Session 3: Plotly',
      list: 'Training'
    })
  })
})

describe('planLectureTask', () => {
  it('leaves an older note alone, however it is edited', () => {
    expect(planLectureTask({ task: '', series: 'Intro to Python', title: 'X' }, [parent])).toEqual({
      kind: 'none'
    })
  })

  it('makes the subtask only once a series is chosen on a marked note', () => {
    expect(planLectureTask({ task: 'auto', series: null, title: 'Plotly' }, [])).toEqual({
      kind: 'none'
    })
    expect(planLectureTask({ task: 'auto', series: '  ', title: 'Plotly' }, [])).toEqual({
      kind: 'none'
    })
    expect(
      planLectureTask({ task: 'auto', series: 'Intro to Python', title: ' Plotly ' }, [parent])
    ).toEqual({
      kind: 'create',
      title: 'Plotly',
      parent: { uid: 'p1' }
    })
    expect(planLectureTask({ task: 'auto', series: 'Intro to Python', title: '' }, [])).toEqual({
      kind: 'create',
      title: 'Untitled',
      parent: { title: 'Intro to Python', list: 'Training' }
    })
  })

  it('renames the subtask when the title changes', () => {
    expect(
      planLectureTask({ task: 's1', series: 'Intro to Python', title: 'Plotly styling' }, [
        parent,
        lecture
      ])
    ).toEqual({ kind: 'sync', uid: 's1', title: 'Plotly styling' })
  })

  it('moves it when the series changes, and ignores case', () => {
    expect(
      planLectureTask({ task: 's1', series: 'Statistics', title: 'Session 3: Plotly' }, [
        parent,
        lecture
      ])
    ).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: { title: 'Statistics', list: 'Training' }
    })
    expect(
      planLectureTask({ task: 's1', series: 'INTRO TO PYTHON', title: 'Session 3: Plotly' }, [
        parent,
        lecture
      ])
    ).toEqual({ kind: 'none' })
  })

  it('does nothing when it is all in step, the series is cleared, or the title is empty', () => {
    const note = { task: 's1', series: 'Intro to Python', title: 'Session 3: Plotly' }
    expect(planLectureTask(note, [parent, lecture])).toEqual({ kind: 'none' })
    expect(planLectureTask({ ...note, series: null }, [parent, lecture])).toEqual({ kind: 'none' })
    expect(planLectureTask({ ...note, title: ' ' }, [parent, lecture])).toEqual({ kind: 'none' })
  })

  it('never renames or moves a plain task, and never remakes a task that is gone', () => {
    expect(planLectureTask({ task: 'p1', series: 'Other', title: 'New name' }, [parent])).toEqual({
      kind: 'none'
    })
    expect(
      planLectureTask({ task: 'gone', series: 'Intro to Python', title: 'X' }, [parent])
    ).toEqual({
      kind: 'none'
    })
  })
})
