import { describe, expect, it } from 'vitest'
import { canUseList, listFor, outsideRule, workClients } from './work-lists'

describe('workClients', () => {
  it('gathers every contract’s clients once, a shared name having one list', () => {
    expect(
      workClients([
        { clients: ['Impact', 'Teaching & Learning'] },
        { clients: ['impact', ' Royal Holloway '] },
        {}
      ])
    ).toEqual(['Impact', 'Teaching & Learning', 'Royal Holloway'])
  })
})

describe('listFor', () => {
  const clients = ['Impact', 'Royal Holloway']
  it('takes only a client in Work, in the client’s own spelling', () => {
    expect(listFor('work', ' royal holloway ', clients)).toBe('Royal Holloway')
    expect(listFor('work', 'Admin', clients)).toBeNull()
    expect(canUseList('work', 'Luminos', clients)).toBe(false)
  })
  it('leaves Research free', () => {
    expect(listFor('research', ' Reading ', clients)).toBe('Reading')
    expect(canUseList('research', 'Anything', [])).toBe(true)
  })
})

describe('outsideRule', () => {
  it('lists the tasks whose list is no client', () => {
    const tasks = [{ list: 'Impact' }, { list: 'Luminos' }, { list: 'impact' }]
    expect(outsideRule(tasks, ['Impact'])).toEqual([{ list: 'Luminos' }])
    expect(outsideRule(tasks, [])).toHaveLength(3)
  })
})
