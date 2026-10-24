import { describe, expect, it } from 'vitest'
import {
  parentIn,
  STUDY_LINE,
  studyName,
  studyNameOf,
  subtaskParent,
  taskLabel
} from './study-label'
import { task as makeTask } from './test-utils'

const series = makeTask({ uid: 'p', title: 'Simulating Social Worlds self-study' })
const day = makeTask({
  uid: 'c',
  title: 'Day 2',
  parentUid: 'p',
  ownKind: 'self-study'
})

describe('studyName', () => {
  it('names a self-study subtask as the Training module names the entry: Series: Title', () => {
    expect(studyName(day, series)).toBe('Simulating Social Worlds: Day 2')
  })
  it('reads the first version’s middle dot in the series task', () => {
    expect(studyName(day, { ...series, title: 'PS5210 · self-study' })).toBe('PS5210: Day 2')
  })
  it('is the title alone when it already starts with the series, or has no series', () => {
    expect(
      studyName({ ...day, title: 'PS5210: Day 2' }, { ...series, title: 'PS5210 self-study' })
    ).toBe('PS5210: Day 2')
    const alone = makeTask({ uid: 'a', title: 'Plotly self-study', ownKind: 'self-study' })
    expect(studyName(alone, undefined)).toBe('Plotly')
  })
  it('is null for any other task, the series task included', () => {
    expect(studyName({ ...day, ownKind: null }, series)).toBeNull()
    expect(studyName(series, undefined)).toBeNull()
  })
  it('does not change the stored title', () => {
    studyName(day, series)
    expect(day.title).toBe('Day 2')
  })
})

describe('studyNameOf', () => {
  it('takes the series from the parent title', () => {
    expect(studyNameOf('Day 1', 'Stats self-study')).toBe('Stats: Day 1')
  })
})

describe('taskLabel', () => {
  it('is the training name for self-study and the title otherwise', () => {
    expect(taskLabel(day, series)).toBe('Simulating Social Worlds: Day 2')
    expect(taskLabel(series, undefined)).toBe('Simulating Social Worlds self-study')
    expect(taskLabel({ ...series, title: '' }, undefined)).toBe('Untitled')
  })
})

describe('subtaskParent', () => {
  it('names the parent of a subtask, but not of a self-study one (its series is in its name)', () => {
    const kid = makeTask({ uid: 'k', title: 'Kid', parentUid: 'p' })
    expect(subtaskParent(kid, [series, kid])).toBe('Simulating Social Worlds self-study')
    expect(subtaskParent(day, [series, day])).toBeNull()
    expect(subtaskParent(series, [series])).toBeNull()
  })
})

describe('parentIn', () => {
  it('finds a parent among the tasks', () => {
    expect(parentIn(day, [series, day])).toBe(series)
    expect(parentIn(series, [series, day])).toBeUndefined()
  })
})

describe('STUDY_LINE', () => {
  it('is the second line of a self-study task', () => {
    expect(STUDY_LINE).toBe('Training · self-study')
  })
})
