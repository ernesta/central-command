import { describe, expect, it } from 'vitest'
import { mine, openTodos, type MeetingTodos } from './open-todos'
import { parseTodos } from './todos'

const meeting = (id: string, series: string, date: string, body: string): MeetingTodos => ({
  id,
  series,
  date,
  todos: parseTodos(body)
})

describe('openTodos', () => {
  const sup1 = meeting(
    '2026-01-01 Supervision',
    'Supervision',
    '2026-01-01',
    '- **TODO(EO)**: old, superseded\n'
  )
  const sup2 = meeting(
    '2026-02-01 Supervision',
    'Supervision',
    '2026-02-01',
    '## Previous TODOs\n\n- [x] **TODO(EO)**: done\n- [ ] **TODO(KR)**: waiting\n\n## Notes\n\n- **TODO(EO)**: new one\n- [x] **TODO(AC)**: ticked inline\n'
  )
  const lab = meeting(
    '2026-01-15 Rastle Lab',
    'Rastle Lab',
    '2026-01-15',
    'TODO: something for the lab\n'
  )

  it('lists, per series, the latest meeting’s unticked previous items and inline TODOs', () => {
    expect(
      openTodos([sup1, sup2, lab]).map((t) => [
        t.series,
        t.meetingId,
        t.owners.join(),
        t.text,
        t.kind
      ])
    ).toEqual([
      ['Supervision', '2026-02-01 Supervision', 'KR', 'waiting', 'previous'],
      ['Supervision', '2026-02-01 Supervision', 'EO', 'new one', 'inline'],
      ['Rastle Lab', '2026-01-15 Rastle Lab', '', 'something for the lab', 'inline']
    ])
  })

  it('uses an upcoming meeting as the latest, once it exists', () => {
    const upcoming = meeting(
      '2099-01-01 Supervision',
      'Supervision',
      '2099-01-01',
      '## Previous TODOs\n\n- [ ] **TODO(KR)**: waiting\n'
    )
    const out = openTodos([sup1, sup2, upcoming])
    expect(out.map((t) => t.meetingId)).toEqual(['2099-01-01 Supervision'])
  })

  it('ignores meetings without a date, shows a repeated item once, and orders series in the fixed order', () => {
    const undated = meeting('x', 'Supervision', '', '- **TODO(EO)**: hidden\n')
    const dup = meeting(
      '2026-03-01 Other',
      'Other',
      '2026-03-01',
      '## Previous TODOs\n- [ ] **TODO(EO)**: same\n## Notes\n- **TODO(EO)**: Same\n'
    )
    const luminos = meeting('2026-03-02 Luminos', 'Luminos', '2026-03-02', '- **TODO(MJ)**: l\n')
    const out = openTodos([dup, undated, luminos, sup2, lab])
    expect(out.map((t) => t.series)).toEqual([
      'Supervision',
      'Supervision',
      'Rastle Lab',
      'Luminos',
      'Other'
    ])
    expect(out.filter((t) => t.series === 'Other')).toHaveLength(1)
    expect(out.some((t) => t.text === 'hidden')).toBe(false)
  })

  it('shows nothing for a series whose only meeting has no date', () => {
    expect(openTodos([meeting('x', 'Other', '', '- **TODO(EO)**: hidden\n')])).toEqual([])
  })

  it('is empty when there are no meetings or nothing open', () => {
    expect(openTodos([])).toEqual([])
    expect(openTodos([meeting('a', 'Other', '2026-01-01', '- [x] **TODO(EO)**: done\n')])).toEqual(
      []
    )
  })

  it('breaks a date tie by id', () => {
    const a = meeting('2026-05-01 Other', 'Other', '2026-05-01', '- **TODO(EO)**: first\n')
    const b = meeting('2026-05-01 Other 2', 'Other', '2026-05-01', '- **TODO(EO)**: second\n')
    expect(openTodos([b, a]).map((t) => t.text)).toEqual(['second'])
  })
})

describe('mine', () => {
  it('keeps only TODOs that list the person, including shared ones', () => {
    const todos = openTodos([
      meeting(
        '2026-02-01 Supervision',
        'Supervision',
        '2026-02-01',
        '- **TODO(EO)**: a\n- **TODO(KR)**: b\n- **TODO(KR & EO)**: c\n- TODO: d\n'
      )
    ])
    expect(mine(todos, 'eo').map((t) => t.text)).toEqual(['a', 'c'])
    expect(mine(todos, '')).toEqual([])
  })
})
