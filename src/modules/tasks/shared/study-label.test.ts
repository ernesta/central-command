import { describe, expect, it } from 'vitest'
import { parentIn, studyLabel, studySeries } from './study-label'
import { task as makeTask } from './test-utils'

const series = makeTask({ uid: 'p', title: 'Simulating Social Worlds self-study' })
const day = makeTask({
  uid: 'c',
  title: 'Day 2 self-study',
  parentUid: 'p',
  ownKind: 'self-study'
})

describe('studySeries', () => {
  it('names the series of a self-study subtask', () => {
    expect(studySeries(day, series)).toBe('Simulating Social Worlds')
  })
  it('takes the first version’s middle dot out too', () => {
    expect(studySeries(day, { ...series, title: 'PS5210 · self-study' })).toBe('PS5210')
  })
  it('is null for any other task', () => {
    expect(studySeries({ ...day, ownKind: null }, series)).toBeNull()
    expect(studySeries(day, undefined)).toBeNull()
    expect(studySeries(day, { ...series, title: 'self-study' })).toBeNull()
  })
})

describe('studyLabel', () => {
  it('puts the series in front', () => {
    expect(studyLabel(day, series)).toBe('Simulating Social Worlds › Day 2 self-study')
  })
  it('leaves other tasks alone', () => {
    expect(studyLabel(series, undefined)).toBe('Simulating Social Worlds self-study')
    expect(studyLabel({ ...series, title: '' }, undefined)).toBe('Untitled')
  })
})

describe('parentIn', () => {
  it('finds the parent', () => {
    expect(parentIn(day, [series, day])).toBe(series)
    expect(parentIn(series, [series, day])).toBeUndefined()
  })
})
