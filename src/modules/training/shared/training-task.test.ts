import { describe, expect, it } from 'vitest'
import type { Task } from '../../tasks/shared/types'
import { parentFor, planTrainingTask, strandedParent } from './training-task'

const task = (uid: string, title: string, over: Partial<Task> = {}): Task => ({
  uid,
  ownKind: null,
  watchItemId: null,
  watchUrl: null,
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
const training = task('s1', 'Session 3: Plotly', { list: '', parentUid: 'p1' })

describe('parentFor', () => {
  it('finds the open top-level task called the series, ignoring case, else says what to create', () => {
    expect(parentFor('intro to python ', [parent])).toEqual({ uid: 'p1' })
    expect(parentFor('Intro to Python', [])).toEqual({
      title: 'Intro to Python',
      list: 'Training'
    })
  })
  it('prefers the Training list, skips done tasks and subtasks', () => {
    const other = task('p2', 'Intro to Python', { list: 'Reading' })
    expect(parentFor('Intro to Python', [other, parent])).toEqual({ uid: 'p1' })
    expect(parentFor('Intro to Python', [other])).toEqual({ uid: 'p2' })
    expect(parentFor('Intro to Python', [{ ...parent, status: 'done' }])).toEqual({
      title: 'Intro to Python',
      list: 'Training'
    })
    expect(parentFor('Session 3: Plotly', [training])).toEqual({
      title: 'Session 3: Plotly',
      list: 'Training'
    })
  })
  it('still matches an older "Complete <course>" series task', () => {
    expect(parentFor('Complete Intro to Python', [task('p3', 'Intro to Python')])).toEqual({
      uid: 'p3'
    })
  })
})

describe('planTrainingTask', () => {
  it('leaves an older note alone, however it is edited', () => {
    expect(planTrainingTask({ task: '', series: 'Intro to Python', title: 'X' }, [parent])).toEqual(
      {
        kind: 'none'
      }
    )
  })

  it('makes the subtask under the series task once a series is chosen on a marked note', () => {
    expect(planTrainingTask({ task: 'auto', series: '  ', title: '' }, [])).toEqual({
      kind: 'none'
    })
    expect(
      planTrainingTask({ task: 'auto', series: 'Intro to Python', title: ' Plotly ' }, [parent])
    ).toEqual({
      kind: 'create',
      title: 'Plotly',
      parent: { uid: 'p1' }
    })
    expect(planTrainingTask({ task: 'auto', series: 'Intro to Python', title: '' }, [])).toEqual({
      kind: 'create',
      title: 'Untitled',
      parent: { title: 'Intro to Python', list: 'Training' }
    })
  })

  it('renames the subtask when the title changes', () => {
    expect(
      planTrainingTask({ task: 's1', series: 'Intro to Python', title: 'Plotly styling' }, [
        parent,
        training
      ])
    ).toEqual({ kind: 'sync', uid: 's1', title: 'Plotly styling' })
  })

  it('moves it when the series changes, and ignores case', () => {
    expect(
      planTrainingTask({ task: 's1', series: 'Statistics', title: 'Session 3: Plotly' }, [
        parent,
        training
      ])
    ).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: { title: 'Statistics', list: 'Training' }
    })
    expect(
      planTrainingTask({ task: 's1', series: 'INTRO TO PYTHON', title: 'Session 3: Plotly' }, [
        parent,
        training
      ])
    ).toEqual({ kind: 'none' })
  })

  it('does nothing when it is all in step or the title is empty', () => {
    const note = { task: 's1', series: 'Intro to Python', title: 'Session 3: Plotly' }
    expect(planTrainingTask(note, [parent, training])).toEqual({ kind: 'none' })
    expect(planTrainingTask({ ...note, title: ' ' }, [parent, training])).toEqual({ kind: 'none' })
  })

  it('never renames or moves a plain task, and never remakes a task that is gone', () => {
    const plain = task('x1', 'Read', { list: 'Reading' })
    expect(planTrainingTask({ task: 'x1', series: 'Other', title: 'New name' }, [plain])).toEqual({
      kind: 'none'
    })
    expect(
      planTrainingTask({ task: 'gone', series: 'Intro to Python', title: 'X' }, [parent])
    ).toEqual({
      kind: 'none'
    })
  })
})

describe('a training with no series', () => {
  const alone = task('a1', 'Workshop')
  it('gets a task of its own once it has a title', () => {
    expect(planTrainingTask({ task: 'auto', series: null, title: ' Workshop ' }, [])).toEqual({
      kind: 'create',
      title: 'Workshop',
      parent: null
    })
    expect(planTrainingTask({ task: 'auto', series: null, title: 'Untitled' }, [])).toEqual({
      kind: 'none'
    })
  })
  it('lets the title follow', () => {
    expect(
      planTrainingTask({ task: 'a1', series: null, title: 'Plotly workshop' }, [alone])
    ).toEqual({ kind: 'sync', uid: 'a1', title: 'Plotly workshop' })
    expect(planTrainingTask({ task: 'a1', series: null, title: 'Untitled' }, [alone])).toEqual({
      kind: 'none'
    })
  })
  it('goes under the series task when a series is added', () => {
    expect(
      planTrainingTask({ task: 'a1', series: 'Intro to Python', title: 'Workshop' }, [
        alone,
        parent
      ])
    ).toEqual({ kind: 'sync', uid: 'a1', parent: { uid: 'p1' } })
    expect(
      planTrainingTask({ task: 'a1', series: 'Workshop', title: 'Workshop' }, [alone])
    ).toEqual({ kind: 'sync', uid: 'a1', parent: { title: 'Workshop', list: 'Training' } })
  })
  it('comes out again when the series is cleared', () => {
    expect(
      planTrainingTask({ task: 's1', series: null, title: 'Session 3: Plotly' }, [parent, training])
    ).toEqual({
      kind: 'sync',
      uid: 's1',
      parent: null
    })
  })
  it('never renames or moves a series task or a task in another list', () => {
    const kid = task('k', 'Part', { list: '', parentUid: 'p1' })
    expect(planTrainingTask({ task: 'p1', series: null, title: 'New' }, [parent, kid])).toEqual({
      kind: 'none'
    })
    expect(
      planTrainingTask({ task: 'a1', series: null, title: 'New' }, [{ ...alone, list: 'Reading' }])
    ).toEqual({ kind: 'none' })
  })
})

describe('a training task is due on the date of its note', () => {
  it('is made with it and takes it when it has none or the date moves', () => {
    expect(
      planTrainingTask({ task: 'auto', series: null, title: 'Day 1', date: '2026-10-09' }, [])
    ).toEqual({ kind: 'create', title: 'Day 1', parent: null, due: '2026-10-09' })
    const own = task('l', 'Day 1', { due: null })
    expect(
      planTrainingTask({ task: 'l', series: null, title: 'Day 1', date: '2026-10-09' }, [own])
    ).toEqual({ kind: 'sync', uid: 'l', due: '2026-10-09' })
    expect(
      planTrainingTask({ task: 'l', series: null, title: 'Day 1', date: '2026-10-09' }, [
        { ...own, due: '2026-10-09' }
      ])
    ).toEqual({ kind: 'none' })
  })
  it('is left undated while the note has no date', () => {
    expect(planTrainingTask({ task: 'auto', series: null, title: 'Day 1', date: '' }, [])).toEqual({
      kind: 'create',
      title: 'Day 1',
      parent: null
    })
  })
})

describe('strandedParent', () => {
  const kid = task('s2', 'Other training', { list: '', parentUid: 'p1' })
  it('names a series task this page made once the training has left it empty', () => {
    expect(strandedParent(new Set(['p1']), 'p1', [parent])).toBe('p1')
  })
  it('never names one that still has a training in it, or that the user made', () => {
    expect(strandedParent(new Set(['p1']), 'p1', [parent, kid])).toBeNull()
    expect(strandedParent(new Set(), 'p1', [parent])).toBeNull()
    expect(strandedParent(new Set(['p1']), null, [parent])).toBeNull()
  })
})
