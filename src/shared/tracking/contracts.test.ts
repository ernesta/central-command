import { describe, expect, it } from 'vitest'
import {
  clientForList,
  contractForClient,
  contractOfLastClient,
  contractToShow,
  holding,
  openContracts
} from './contracts'
import { defaultPlan, emptyYear, type TrackingYear } from './types'

const luminos = (): TrackingYear => ({
  ...emptyYear('2026-05-01', defaultPlan('work'), 0),
  weeks: 26
})
const ra = (): TrackingYear => ({
  ...emptyYear('2026-09-25', { ...defaultPlan('work'), clients: ['Research Assistant'] }, 0),
  weeks: 4,
  name: 'Research Assistant'
})
const years = [ra(), luminos()]

describe('contracts that hold a date', () => {
  it('lists those whose weeks include it', () => {
    expect(holding(years, '2026-09-29').map((y) => y.start)).toEqual(['2026-09-25', '2026-05-01'])
    expect(holding(years, '2026-10-25').map((y) => y.start)).toEqual(['2026-05-01'])
    expect(holding(years, '2027-01-01')).toEqual([])
  })

  it('finds the one with a client, exactly spelled', () => {
    expect(contractForClient(years, '2026-09-29', 'Impact')?.start).toBe('2026-05-01')
    expect(contractForClient(years, '2026-09-29', 'Research Assistant')?.start).toBe('2026-09-25')
    expect(contractForClient(years, '2026-09-29', 'impact')).toBeUndefined()
    expect(contractForClient(years, '2026-10-25', 'Research Assistant')).toBeUndefined()
  })

  it("takes a task's list as the client when it matches, ignoring case", () => {
    expect(clientForList(years, '2026-09-29', 'impact')).toBe('Impact')
    expect(clientForList(years, '2026-09-29', ' Research Assistant ')).toBe('Research Assistant')
    expect(clientForList(years, '2026-09-29', 'Inbox')).toBeUndefined()
    expect(clientForList(years, '2026-10-25', 'Research Assistant')).toBeUndefined()
  })
})

describe('the contract of the client used last', () => {
  it('is the newest-listed one when nothing was used', () => {
    expect(contractOfLastClient(years, '2026-09-29')?.start).toBe('2026-09-25')
  })

  it('follows the latest session or typed entry, whichever contract it is in', () => {
    const l = luminos()
    l.sessions.push({
      id: 'a',
      date: '2026-09-28',
      start: '09:00:00',
      end: '10:00:00',
      label: 'x',
      client: 'Impact'
    })
    expect(contractOfLastClient([ra(), l], '2026-09-29')?.start).toBe('2026-05-01')
    const r = ra()
    r.adjusts.push({
      id: 'b',
      date: '2026-09-28',
      label: 'y',
      minutes: 30,
      client: 'Research Assistant'
    })
    // A typed entry counts as the end of its day, so it is later than a session that day.
    expect(contractOfLastClient([r, l], '2026-09-29')?.start).toBe('2026-09-25')
  })

  it('ignores a client no longer on the plan', () => {
    const l = luminos()
    l.sessions.push({
      id: 'a',
      date: '2026-09-28',
      start: '09:00:00',
      end: '10:00:00',
      label: 'x',
      client: 'Gone'
    })
    expect(contractOfLastClient([ra(), l], '2026-09-29')?.start).toBe('2026-09-25')
  })
})

describe('open contracts', () => {
  it('names each contract that holds the day with its clients; one without clients is left out', () => {
    expect(openContracts(years, '2026-09-29')).toEqual({
      contracts: [
        { year: '2026-09-25', name: 'Research Assistant', clients: ['Research Assistant'] },
        { year: '2026-05-01', clients: ['Impact', 'Teaching & Learning'] }
      ],
      last: 'Research Assistant'
    })
    const bare = { ...luminos(), plan: { ...luminos().plan, clients: undefined } }
    expect(openContracts([bare], '2026-09-29')).toEqual({ contracts: [] })
  })
})

describe('the contract the page opens on', () => {
  const years = ['2026-09-30', '2026-05-01', '2025-10-01']
  const open = {
    contracts: [
      { year: '2026-09-30', name: 'Research Assistant', clients: ['RA'] },
      { year: '2026-05-01', name: 'Luminos', clients: ['Impact', 'Teaching & Learning'] }
    ],
    last: 'Impact'
  }

  it('is the one last shown when it holds today', () => {
    expect(contractToShow(years, '2026-10-06', open, '2026-09-30')).toBe('2026-09-30')
  })

  it('is the one of the client used last when nothing is remembered or it no longer holds today', () => {
    expect(contractToShow(years, '2026-10-06', open)).toBe('2026-05-01')
    expect(contractToShow(years, '2026-10-06', open, '2025-10-01')).toBe('2026-05-01')
  })

  it('is the newest start when no client was used', () => {
    expect(contractToShow(years, '2026-10-06', { contracts: open.contracts })).toBe('2026-09-30')
  })

  it('is the newest that has started when none holds today, even if an older one just ended', () => {
    expect(contractToShow(years, '2027-06-01', { contracts: [] })).toBe('2026-09-30')
    expect(contractToShow(years, '2026-06-01', { contracts: [] }, '2026-09-30')).toBe('2026-05-01')
  })

  it('is the newest when none has started, and nothing when there are none', () => {
    expect(contractToShow(['2027-01-01'], '2026-06-01', { contracts: [] })).toBe('2027-01-01')
    expect(contractToShow([], '2026-06-01', { contracts: [] })).toBe('')
  })
})
