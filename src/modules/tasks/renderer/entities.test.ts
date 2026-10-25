import { describe, expect, it } from 'vitest'
import { task } from '../shared/test-utils'
import { detailOf } from './entities'

describe('the @ picker’s task line', () => {
  const parent = task({
    uid: 'p',
    title: 'Write',
    list: 'Impact',
    sublist: 'Historical Data Analysis'
  })
  const sub = task({ uid: 's', title: 'Intro', parentUid: 'p', list: '' })
  const all = [parent, sub]

  it('is the list for a task and the workspace after it', () => {
    expect(detailOf(parent, all)).toBe('Impact › Historical Data Analysis · Research')
  })

  it('names the parent first for a subtask, with the parent’s whole place', () => {
    expect(detailOf(sub, all)).toBe('↳ Write · Impact › Historical Data Analysis · Research')
  })

  it('shows a self-study task as the training it is, with no parent', () => {
    const study = task({ uid: 'x', title: 'Day 1', parentUid: 'p', ownKind: 'self-study' })
    expect(detailOf(study, [parent, study])).toBe('Training · self-study · Research')
  })
})
