import { describe, expect, it } from 'vitest'
import {
  carryOver,
  findPreviousMeeting,
  insertPreviousTodos,
  todosToCarry,
  type MeetingKey
} from './carry-over'
import { parseTodos } from './todos'

const P = `## Summary

Last time.

## Previous TODOs

- [x] **TODO(EO)**: Start writing up the analysis
- [ ] **TODO(KR)**: Send the contact details
- [ ] Plain unticked

## Notes

### Study 1

- **TODO(EO)**: Re-run the models
- [x] **TODO(AC)**: Already done inline
`

describe('todosToCarry', () => {
  it('carries inline TODOs and unticked Previous TODOs, never ticked ones', () => {
    const carried = todosToCarry(parseTodos(P), [])
    expect(carried.map((t) => [t.owners.join(), t.text])).toEqual([
      ['KR', 'Send the contact details'],
      ['', 'Plain unticked'],
      ['EO', 'Re-run the models']
    ])
  })

  it('does not carry what the current Previous TODOs already list, ticked or not', () => {
    const current = parseTodos(
      '## Previous TODOs\n\n- [x] **TODO(KR)**: send the contact details.\n- [ ] **TODO(EO)**: Re-run the models\n'
    )
    expect(todosToCarry(parseTodos(P), current).map((t) => t.text)).toEqual(['Plain unticked'])
  })

  it('does not count the current meeting’s inline TODOs as already carried', () => {
    const current = parseTodos('## Notes\n- **TODO(KR)**: Send the contact details\n')
    expect(todosToCarry(parseTodos(P), current).map((t) => t.text)).toContain(
      'Send the contact details'
    )
  })

  it('lists a TODO once even if the previous note has it twice', () => {
    const prev = parseTodos(
      '## Previous TODOs\n- [ ] **TODO(EO)**: x\n## Notes\n- **TODO(EO)**: X\n'
    )
    expect(todosToCarry(prev, [])).toHaveLength(1)
  })

  it('treats a different owner as a different TODO', () => {
    const prev = parseTodos('- **TODO(EO)**: x\n')
    const current = parseTodos('## Previous TODOs\n- [ ] **TODO(KR)**: x\n')
    expect(todosToCarry(prev, current)).toHaveLength(1)
  })

  it('does not double up an old plain checkbox with the same text', () => {
    const prev = parseTodos('- **TODO(EO)**: Start writing up\n')
    const current = parseTodos('## Previous TODOs\n- [ ] Start writing up\n')
    expect(todosToCarry(prev, current)).toEqual([])
  })
})

describe('insertPreviousTodos', () => {
  const items = [
    { owners: ['EO'], text: 'One' },
    { owners: ['KR', 'AC'], text: 'Two' }
  ]

  it('adds after the last item of an existing section, keeping the blank line before the next heading', () => {
    const body = '## Previous TODOs\n\n- [x] **TODO(EO)**: Old\n\n## Notes\n'
    expect(insertPreviousTodos(body, items)).toBe(
      '## Previous TODOs\n\n- [x] **TODO(EO)**: Old\n- [ ] **TODO(EO)**: One\n- [ ] **TODO(KR & AC)**: Two\n\n## Notes\n'
    )
  })

  it('fills an empty section (the new-meeting template)', () => {
    expect(insertPreviousTodos('## Summary\n\n## Previous TODOs\n\n## Notes\n', items)).toBe(
      '## Summary\n\n## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n- [ ] **TODO(KR & AC)**: Two\n\n## Notes\n'
    )
  })

  it('fills an empty section with no blank line, at the end of the note, or without a final newline', () => {
    expect(insertPreviousTodos('## Previous TODOs\n## Notes\n', items.slice(0, 1))).toBe(
      '## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n\n## Notes\n'
    )
    expect(insertPreviousTodos('## Previous TODOs\n', items.slice(0, 1))).toBe(
      '## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n'
    )
    expect(insertPreviousTodos('## Previous TODOs', items.slice(0, 1))).toBe(
      '## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n'
    )
  })

  it('appends to the last item even without a final newline', () => {
    expect(insertPreviousTodos('## Previous TODOs\n- [ ] a', items.slice(0, 1))).toBe(
      '## Previous TODOs\n- [ ] a\n- [ ] **TODO(EO)**: One\n'
    )
  })

  it('creates the section before Notes when it is missing', () => {
    expect(insertPreviousTodos('## Summary\n\nHi\n\n## Notes\n\ntext\n', items.slice(0, 1))).toBe(
      '## Summary\n\nHi\n\n## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n\n## Notes\n\ntext\n'
    )
  })

  it('creates the section at the end when there is no Notes heading either', () => {
    expect(insertPreviousTodos('Just text\n', items.slice(0, 1))).toBe(
      'Just text\n\n## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n'
    )
    expect(insertPreviousTodos('Just text', items.slice(0, 1))).toBe(
      'Just text\n\n## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n'
    )
    expect(insertPreviousTodos('', items.slice(0, 1))).toBe(
      '## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n'
    )
  })

  it('ignores a Previous TODOs heading inside a code fence', () => {
    const body = '```\n## Previous TODOs\n```\n## Notes\n'
    const out = insertPreviousTodos(body, items.slice(0, 1))
    expect(out).toBe(
      '```\n## Previous TODOs\n```\n## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n\n## Notes\n'
    )
  })

  it('never inserts inside a code fence that is never closed', () => {
    const body = 'text\n```\n## Previous TODOs\ncode'
    const out = insertPreviousTodos(body, items.slice(0, 1))
    expect(out).toBe(
      'text\n## Previous TODOs\n\n- [ ] **TODO(EO)**: One\n\n```\n## Previous TODOs\ncode'
    )
    expect(parseTodos(out).map((t) => t.kind)).toEqual(['previous'])
    // A section whose end is swallowed by an unclosed fence gets its items before the fence.
    const body2 = '## Previous TODOs\n- [ ] a\n```\ncode'
    expect(insertPreviousTodos(body2, items.slice(0, 1))).toBe(
      '## Previous TODOs\n- [ ] a\n- [ ] **TODO(EO)**: One\n```\ncode'
    )
  })

  it('follows the note’s line endings', () => {
    const body = '## Previous TODOs\r\n\r\n- [ ] a\r\n\r\n## Notes\r\n'
    expect(insertPreviousTodos(body, items.slice(0, 1))).toBe(
      '## Previous TODOs\r\n\r\n- [ ] a\r\n- [ ] **TODO(EO)**: One\r\n\r\n## Notes\r\n'
    )
  })

  it('returns the very same text when there is nothing to add', () => {
    const body = 'anything\r\n at all \t\n'
    expect(insertPreviousTodos(body, [])).toBe(body)
  })
})

describe('carryOver', () => {
  const CURRENT = '## Summary\n\n## Previous TODOs\n\n## Notes\n\n### New topic\n'

  it('fills a new meeting from the previous one', () => {
    const { body, added } = carryOver(P, CURRENT)
    expect(added).toHaveLength(3)
    expect(body).toBe(
      '## Summary\n\n## Previous TODOs\n\n- [ ] **TODO(KR)**: Send the contact details\n- [ ] **TODO**: Plain unticked\n- [ ] **TODO(EO)**: Re-run the models\n\n## Notes\n\n### New topic\n'
    )
  })

  it('is idempotent: opening the meeting again adds nothing', () => {
    const once = carryOver(P, CURRENT)
    const twice = carryOver(P, once.body)
    expect(twice.added).toEqual([])
    expect(twice.body).toBe(once.body)
  })

  it('never touches ticked state, existing items or anything else the user wrote', () => {
    const current =
      '## Summary\n\nMy summary   \n\n## Previous TODOs\n\n- [x] **TODO(KR)**: Send the contact details\n- [ ] Custom item I typed\n\n## Notes\n\nfree   text\t\n'
    const { body } = carryOver(P, current)
    // Everything that was there is still there, in order, byte for byte...
    expect(body).toContain('My summary   \n')
    expect(body).toContain(
      '- [x] **TODO(KR)**: Send the contact details\n- [ ] Custom item I typed\n'
    )
    expect(body).toContain('free   text\t\n')
    // ...and the ticked item stays ticked and is not re-added as a second, unticked copy.
    expect(body.match(/Send the contact details/g)).toHaveLength(1)
  })

  it('adds nothing when the previous meeting has nothing open', () => {
    const { body, added } = carryOver('## Previous TODOs\n\n- [x] **TODO(EO)**: done\n', CURRENT)
    expect(added).toEqual([])
    expect(body).toBe(CURRENT)
  })
})

// The rule that matters most: carrying over only ever adds. Checked on many generated notes.
describe('carry-over only adds (generated notes)', () => {
  const pieces = [
    '## Summary',
    '## Previous TODOs',
    '## Notes',
    '### Topic',
    '',
    '',
    'Some text   ',
    '\tTabbed line',
    '- [ ] **TODO(EO)**: alpha',
    '- [x] **TODO(EO)**: alpha',
    '- [ ] **TODO(KR & AC)**: beta',
    '- [ ] plain gamma',
    '- **TODO(AC)**: delta',
    'TODO: epsilon',
    '```',
    '## Previous TODOs',
    '---',
    '- [ ] **TODO(EO)**: ALPHA.'
  ]
  let seed = 4242
  const rnd = (n: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed % n
  }
  const note = (): string => {
    const eol = rnd(4) === 0 ? '\r\n' : '\n'
    const lines = Array.from({ length: rnd(14) }, () => pieces[rnd(pieces.length)])
    return lines.join(eol) + (rnd(2) ? eol : '')
  }
  const isSubsequence = (small: string, big: string): boolean => {
    let i = 0
    for (const c of big) if (i < small.length && c === small[i]) i++
    return i === small.length
  }

  it('keeps every original character in place, keeps every existing item as it was, and is idempotent', () => {
    for (let n = 0; n < 4000; n++) {
      const previous = note()
      const current = note()
      const before = parseTodos(current)
      const { body, added } = carryOver(previous, current)

      expect(isSubsequence(current, body)).toBe(true)
      expect(body.length).toBeGreaterThanOrEqual(current.length)

      // Each item that was in the note is still there with the same owners, text and ticked state.
      const after = parseTodos(body)
      for (const item of before) {
        expect(
          after.some(
            (a) =>
              a.kind === item.kind &&
              a.done === item.done &&
              a.text === item.text &&
              a.owners.join() === item.owners.join()
          )
        ).toBe(true)
      }
      // Exactly the items reported as added appeared, all as unticked Previous TODOs.
      const newPrevious =
        after.filter((a) => a.kind === 'previous').length -
        before.filter((b) => b.kind === 'previous').length
      expect(newPrevious).toBe(added.length)
      expect(after.filter((a) => a.kind === 'previous' && a.done).length).toBe(
        before.filter((b) => b.kind === 'previous' && b.done).length
      )
      expect(after.filter((a) => a.done).length).toBe(before.filter((b) => b.done).length)

      // Nothing ticked in the previous note is carried; a second sync adds nothing.
      const again = carryOver(previous, body)
      try {
        expect(again.body).toBe(body)
        expect(again.added).toEqual([])
      } catch (error) {
        throw new Error(
          `${(error as Error).message}\n${JSON.stringify({ previous, current, body })}`
        )
      }
    }
  })
})

describe('findPreviousMeeting', () => {
  const m = (id: string, series: string, date: string, workspace = 'research'): MeetingKey => ({
    id,
    series,
    date,
    workspace
  })
  const all = [
    m('2026-01-01 Supervision', 'Supervision', '2026-01-01'),
    m('2026-02-01 Supervision', 'Supervision', '2026-02-01'),
    m('2026-02-15 Rastle Lab', 'Rastle Lab', '2026-02-15'),
    m('2026-03-01 Supervision', 'Supervision', '2026-03-01')
  ]

  it('is the latest earlier meeting of the same series', () => {
    expect(findPreviousMeeting(all, all[3])?.id).toBe('2026-02-01 Supervision')
    expect(findPreviousMeeting(all, all[1])?.id).toBe('2026-01-01 Supervision')
  })
  it('is null for the first meeting of a series, for another series, and without a date', () => {
    expect(findPreviousMeeting(all, all[0])).toBeNull()
    expect(findPreviousMeeting(all, all[2])).toBeNull()
    expect(findPreviousMeeting(all, m('x', 'Supervision', ''))).toBeNull()
  })
  it('orders two meetings on the same day by id', () => {
    const day = [
      m('2026-04-01 Other', 'Other', '2026-04-01'),
      m('2026-04-01 Other 2', 'Other', '2026-04-01')
    ]
    expect(findPreviousMeeting(day, day[1])?.id).toBe('2026-04-01 Other')
    expect(findPreviousMeeting(day, day[0])).toBeNull()
  })
  it('ignores meetings without a date and those in another workspace, and never returns itself', () => {
    const list = [
      m('a', 'Other', ''),
      m('b', 'Other', '2026-01-01', 'work'),
      m('c', 'Other', '2026-02-01')
    ]
    expect(findPreviousMeeting(list, list[2])).toBeNull()
  })
  it('includes upcoming meetings as a previous meeting for a later one', () => {
    const list = [
      m('2027-01-01 Other', 'Other', '2027-01-01'),
      m('2027-02-01 Other', 'Other', '2027-02-01')
    ]
    expect(findPreviousMeeting(list, list[1])?.id).toBe('2027-01-01 Other')
  })
})
