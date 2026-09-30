import { describe, expect, it } from 'vitest'
import { trainingBaseName } from './file-name'

describe('trainingBaseName', () => {
  it('puts the series before the title', () => {
    expect(
      trainingBaseName('2026-09-30', 'Introduction', 'PS5210 Applied Neuroscience Methods', [])
    ).toBe('2026-09-30 PS5210 Applied Neuroscience Methods - Introduction')
  })

  it('uses the title alone with no series, or when the title is the series', () => {
    expect(trainingBaseName('2026-09-30', 'Survey Design', null, [])).toBe(
      '2026-09-30 Survey Design'
    )
    expect(
      trainingBaseName(
        '2025-10-10',
        'PS5302 Statistics for Research',
        'PS5302 Statistics for Research',
        []
      )
    ).toBe('2025-10-10 PS5302 Statistics for Research')
  })

  it('numbers a taken name and replaces unsafe characters', () => {
    expect(
      trainingBaseName('2026-02-05', 'Rapid Reading', 'SEDarc', [
        '2026-02-05 SEDarc - Rapid Reading'
      ])
    ).toBe('2026-02-05 SEDarc - Rapid Reading 2')
    expect(trainingBaseName('2026-02-05', 'A: B', 'X', [])).toBe('2026-02-05 X - A_ B')
  })
})
