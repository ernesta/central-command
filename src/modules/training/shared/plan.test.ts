import { describe, expect, it } from 'vitest'
import { planFileName, planYearFromFileName } from './plan'

describe('plan file names', () => {
  it('round-trips the academic year', () => {
    expect(planFileName(2026)).toBe('Training plan 2026-27.md')
    expect(planYearFromFileName('Training plan 2026-27.md')).toBe(2026)
    expect(planYearFromFileName('Training plan 2026-27.md.bak')).toBeNull()
    expect(planYearFromFileName('2026-09-24 Seminar.md')).toBeNull()
  })
})
