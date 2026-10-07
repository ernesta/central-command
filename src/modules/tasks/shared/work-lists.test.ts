import { describe, expect, it } from 'vitest'
import { canUseList, listFor, workClients } from './work-lists'

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
  it('leaves Research and Life free', () => {
    expect(listFor('research', ' Reading ', clients)).toBe('Reading')
    expect(canUseList('life', 'Anything', [])).toBe(true)
  })
})
