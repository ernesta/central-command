import { describe, expect, it } from 'vitest'
import type { OpenContracts } from './contracts'
import { yearToShow } from './current-year'

const open = (years: string[], last?: string): OpenContracts => ({
  contracts: years.map((year) => ({
    year,
    clients: [year === '2026-09-01' ? 'Impact' : 'Luminos']
  })),
  ...(last ? { last } : {})
})

describe('yearToShow', () => {
  const starts = ['2025-09-22', '2026-09-21']

  it('Research opens on the year of the settings that holds today', () => {
    expect(
      yearToShow('research', '2026-10-15', { yearStarts: starts, years: null, open: null })
    ).toBe('2026-09-21')
    expect(
      yearToShow('research', '2026-03-01', { yearStarts: starts, years: null, open: null })
    ).toBe('2025-09-22')
  })

  it('Work opens on a contract that holds today: the remembered one, else the one of the last client, else the newest', () => {
    const years = ['2026-09-15', '2026-09-01']
    const o = open(years, 'Impact')
    const base = { yearStarts: starts, years, open: o }
    expect(yearToShow('work', '2026-10-15', base)).toBe('2026-09-01')
    expect(yearToShow('work', '2026-10-15', { ...base, remembered: '2026-09-15' })).toBe(
      '2026-09-15'
    )
    expect(yearToShow('work', '2026-10-15', { ...base, open: open(years) })).toBe('2026-09-15')
  })

  it('Work waits (no year) until the years and the open contracts are read', () => {
    expect(yearToShow('work', '2026-10-15', { yearStarts: starts, years: null, open: null })).toBe(
      ''
    )
    expect(
      yearToShow('work', '2026-10-15', { yearStarts: starts, years: ['2026-09-01'], open: null })
    ).toBe('')
  })
})
