import { describe, expect, it } from 'vitest'
import {
  allClients,
  canonicalClient,
  checkRename,
  cleanClientName,
  clientRefusal,
  clientsLost,
  renameClientInYear
} from './client-names'
import { WORK_PLAN, emptyYear } from './types'

const plan = (...clients: string[]): { clients: string[] } => ({ clients })

describe('a client name', () => {
  it('is trimmed and spaced once, not empty, not over 40 characters', () => {
    expect(cleanClientName('  Royal   Holloway ')).toBe('Royal Holloway')
    expect(cleanClientName('   ')).toBeNull()
    expect(cleanClientName('x'.repeat(40))).not.toBeNull()
    expect(cleanClientName('x'.repeat(41))).toBeNull()
  })
  it('is one client in two contracts, whatever the case, with the first spelling met', () => {
    expect(allClients([plan('Impact', 'Teaching'), plan('impact', 'Other')])).toEqual([
      'Impact',
      'Teaching',
      'Other'
    ])
    expect(canonicalClient([plan('Impact')], 'IMPACT')).toBe('Impact')
    expect(canonicalClient([plan('Impact')], 'New')).toBe('New')
  })
})

describe('the clients a plan loses', () => {
  it('are the ones gone from its list that no other contract has', () => {
    expect(clientsLost(['A', 'B'], ['A'], [])).toEqual(['B'])
    expect(clientsLost(['A', 'B'], ['A'], [plan('b')])).toEqual([])
    expect(clientsLost(['A', 'B'], ['a', 'b'], [])).toEqual([])
  })
})

describe('renaming', () => {
  const plans = [plan('Impact', 'Teaching'), plan('Impact')]
  it('is allowed to a new name, and to the same name in another case', () => {
    expect(checkRename(plans, 'Impact', ' Impact Ltd ')).toEqual({ ok: true, to: 'Impact Ltd' })
    expect(checkRename(plans, 'Impact', 'IMPACT')).toEqual({ ok: true, to: 'IMPACT' })
  })
  it('is refused for an unknown client, a bad name, or a name another client has', () => {
    expect(checkRename(plans, 'Nobody', 'X')).toEqual({ ok: false, reason: 'unknown-client' })
    expect(checkRename(plans, 'Impact', '  ')).toEqual({ ok: false, reason: 'bad-name' })
    expect(checkRename(plans, 'Impact', 'teaching')).toEqual({ ok: false, reason: 'client-exists' })
  })
  it('changes the plan, sessions and typed time of a year, not the minutes or other clients', () => {
    const base = { ...emptyYear('2026-09-25', WORK_PLAN), weeks: 4 }
    const year = {
      ...base,
      sessions: [
        {
          id: 's1',
          date: '2026-09-29',
          start: '09:00:00',
          end: '10:00:00',
          minutes: 60,
          label: 'a',
          client: 'Impact'
        },
        {
          id: 's2',
          date: '2026-09-29',
          start: '11:00:00',
          end: '12:00:00',
          minutes: 60,
          label: 'b',
          client: 'Teaching & Learning'
        }
      ],
      adjusts: [{ id: 'a1', date: '2026-09-29', label: 'c', minutes: 30, client: 'impact' }]
    }
    const next = renameClientInYear(year, 'Impact', 'Impact Ltd')
    expect(next.plan.clients).toEqual(['Impact Ltd', 'Teaching & Learning'])
    expect(next.sessions.map((s) => s.client)).toEqual(['Impact Ltd', 'Teaching & Learning'])
    expect(next.sessions[0].minutes).toBe(60)
    expect(next.adjusts[0].client).toBe('Impact Ltd')
  })
})

describe('the words for a refusal', () => {
  it('say which client and how many tasks', () => {
    expect(clientRefusal('client-has-tasks', 'Impact', 3)).toBe(
      'Impact still has 3 tasks. Move or delete them first.'
    )
    expect(clientRefusal('client-has-tasks', 'Impact', 1)).toContain('1 task.')
  })
})
