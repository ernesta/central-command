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

  it('lists every meeting’s unticked previous items and inline TODOs, newest first', () => {
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
      ['Rastle Lab', '2026-01-15 Rastle Lab', '', 'something for the lab', 'inline'],
      ['Supervision', '2026-01-01 Supervision', 'EO', 'old, superseded', 'inline']
    ])
  })

  it('lists the later copy of a carried TODO, not the older one', () => {
    const upcoming = meeting(
      '2099-01-01 Supervision',
      'Supervision',
      '2099-01-01',
      '## Previous TODOs\n\n- [ ] **TODO(KR)**: waiting\n'
    )
    const out = openTodos([sup1, sup2, upcoming])
    expect(out.map((t) => [t.meetingId, t.text])).toEqual([
      ['2099-01-01 Supervision', 'waiting'],
      ['2026-02-01 Supervision', 'new one'],
      ['2026-01-01 Supervision', 'old, superseded']
    ])
  })

  it('drops an older TODO that a later meeting ticked', () => {
    const older = meeting('2026-01-01 Other', 'Other', '2026-01-01', '- **TODO(EO)**: ship it\n')
    const newer = meeting(
      '2026-02-01 Other',
      'Other',
      '2026-02-01',
      '## Previous TODOs\n- [x] **TODO(EO)**: ship it\n'
    )
    expect(openTodos([older, newer])).toEqual([])
  })

  it('ignores meetings without a date, shows a repeated item once, and lists the most recent meeting first', () => {
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
      'Luminos',
      'Other',
      'Supervision',
      'Supervision',
      'Rastle Lab'
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
    const b = meeting(
      '2026-05-01 Other 2',
      'Other',
      '2026-05-01',
      '## Previous TODOs\n- [x] **TODO(EO)**: first\n\n## Notes\n- **TODO(EO)**: second\n'
    )
    expect(openTodos([b, a]).map((t) => t.text)).toEqual(['second'])
  })

  it('lists an earlier meeting’s TODOs while the upcoming note has not been opened', () => {
    const done = meeting(
      '2026-11-02 Impact',
      'Impact',
      '2026-11-02',
      '- [ ] **TODO(EO)**: ghana\n- [x] **TODO(EO)**: ticked\n- [ ] **TODO(MJ)**: papers\n'
    )
    const next = meeting('2026-11-19 Impact', 'Impact', '2026-11-19', '')
    expect(openTodos([done, next]).map((t) => [t.meetingId, t.text])).toEqual([
      ['2026-11-02 Impact', 'ghana'],
      ['2026-11-02 Impact', 'papers']
    ])
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
