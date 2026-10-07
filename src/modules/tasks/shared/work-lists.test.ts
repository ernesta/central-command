import { describe, expect, it } from 'vitest'
import { canUseList, listFor, offeredLists, outsideRule, workClients } from './work-lists'

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

describe('offeredLists', () => {
  const tasks = [
    { list: 'impact', sublist: 'Data' },
    { list: 'Luminos', sublist: 'Old' },
    { list: 'Impact', sublist: '' }
  ]
  it('in Work offers every client, empty ones too, with the sublists in use, and no list that is no client', () => {
    expect(offeredLists(tasks, ['Impact', 'Royal Holloway'])).toEqual([
      { list: 'Impact', sublist: '' },
      { list: 'Royal Holloway', sublist: '' },
      { list: 'Impact', sublist: 'Data' },
      { list: 'Impact', sublist: '' }
    ])
  })
  it('in Work with no client offers nothing', () => {
    expect(offeredLists(tasks, [])).toEqual([])
  })
  it('leaves Research as it is', () => {
    expect(offeredLists(tasks, null)).toEqual(tasks)
  })
})
