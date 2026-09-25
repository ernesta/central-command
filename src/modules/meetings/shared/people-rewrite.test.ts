import { describe, expect, it } from 'vitest'
import { personChange } from '@shared/people-rewrite'
import { rewriteMeetingPeople } from './people-rewrite'
import { renameTodoOwners } from './todos'

const NOTE = `---
series: Supervision
date: 2026-09-24
attendees: [Ernesta Orlovaitė, Kathy Rastle, Kathy Rastle-Jones]
# a comment that stays
custom: Kathy Rastle
---

## Summary

Kathy Rastle said KR should look at it. TODO(KRX): not ours.

## Previous TODOs

- [x] **TODO(KR)**: Old item
- [ ] **TODO(EO & KR)**: Shared item
- [ ] **TODO(kr, AC)**: Lower case
- [ ] Plain item without owner

## Notes

### Topic
- **TODO(KR):** New item
- TODO (KR): spaced form
- \`TODO(KR): in code\`

\`\`\`
**TODO(KR)**: in a fence
\`\`\`
`

const kathy = personChange(
  { name: 'Kathy Rastle', initials: 'KR' },
  { name: 'Katherine Rastle', initials: 'KRa' }
)

const lines = (s: string): string[] => s.split('\n')

function changedLines(before: string, after: string): [string, string][] {
  const a = lines(before)
  const b = lines(after)
  expect(b).toHaveLength(a.length)
  return a.flatMap((line, i) => (line === b[i] ? [] : [[line, b[i]] as [string, string]]))
}

describe('rewriteMeetingPeople', () => {
  it('changes the attendee, and only a whole-name match', () => {
    const out = rewriteMeetingPeople(NOTE, personChange(kathyName(), kathyName('Katherine Rastle')))
    expect(changedLines(NOTE, out)).toEqual([
      [
        'attendees: [Ernesta Orlovaitė, Kathy Rastle, Kathy Rastle-Jones]',
        'attendees: [Ernesta Orlovaitė, Katherine Rastle, Kathy Rastle-Jones]'
      ]
    ])
  })

  it('changes the initials in TODO owners and nothing else in the note', () => {
    const out = rewriteMeetingPeople(NOTE, personChange(kathyName(), kathyName(undefined, 'KRa')))
    expect(changedLines(NOTE, out)).toEqual([
      ['- [x] **TODO(KR)**: Old item', '- [x] **TODO(KRa)**: Old item'],
      ['- [ ] **TODO(EO & KR)**: Shared item', '- [ ] **TODO(EO & KRa)**: Shared item'],
      ['- [ ] **TODO(kr, AC)**: Lower case', '- [ ] **TODO(KRa, AC)**: Lower case'],
      ['- **TODO(KR):** New item', '- **TODO(KRa):** New item'],
      ['- TODO (KR): spaced form', '- TODO (KRa): spaced form']
    ])
  })

  it('does both at once', () => {
    const out = rewriteMeetingPeople(NOTE, kathy)
    expect(out).toContain('Katherine Rastle,')
    expect(out).toContain('**TODO(EO & KRa)**')
    expect(out).toContain('Kathy Rastle said KR should look at it. TODO(KRX): not ours.')
    expect(out).toContain('`TODO(KR): in code`')
    expect(out).toContain('**TODO(KR)**: in a fence')
    expect(out).toContain('custom: Kathy Rastle')
    expect(out).toContain('# a comment that stays')
  })

  it('returns a note that mentions nobody affected byte for byte', () => {
    const other = personChange(
      { name: 'Someone Else', initials: 'SE' },
      { name: 'Somebody Else', initials: 'SB' }
    )
    expect(rewriteMeetingPeople(NOTE, other)).toBe(NOTE)
    expect(rewriteMeetingPeople(NOTE, personChange(kathyName(), kathyName()))).toBe(NOTE)
  })

  it('keeps CRLF line endings', () => {
    const crlf = NOTE.replace(/\n/g, '\r\n')
    const out = rewriteMeetingPeople(crlf, kathy)
    expect(out.replace(/\r\n/g, '\n')).toBe(rewriteMeetingPeople(NOTE, kathy))
    expect(out.includes('\r\n')).toBe(true)
    expect(out.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('merges: a person already in the list is not listed twice', () => {
    const merged = personChange(
      { name: 'Kathy Rastle-Jones', initials: 'KRJ' },
      { name: 'Kathy Rastle', initials: 'KR' }
    )
    const note = '---\nattendees: [Kathy Rastle, Kathy Rastle-Jones]\n---\n\n- TODO(KR & KRJ): a\n'
    expect(rewriteMeetingPeople(note, merged)).toBe(
      '---\nattendees: [Kathy Rastle]\n---\n\n- TODO(KR): a\n'
    )
  })
})

describe('renameTodoOwners', () => {
  const swap = new Map([['A', 'B']])
  it('keeps separators and spacing', () => {
    expect(renameTodoOwners('TODO( A , C ): x', swap).body).toBe('TODO( B , C ): x')
    expect(renameTodoOwners('TODO(C and A): x', swap).body).toBe('TODO(C and B): x')
    expect(renameTodoOwners('TODO(C/A+D): x', swap).body).toBe('TODO(C/B+D): x')
  })
  it('handles several markers on a line and counts them', () => {
    const r = renameTodoOwners('**TODO(A)**: x **TODO(C)**: y **TODO(A & D)**: z', swap)
    expect(r.body).toBe('**TODO(B)**: x **TODO(C)**: y **TODO(B & D)**: z')
    expect(r.changed).toBe(2)
  })
  it('leaves unbracketed and other text alone', () => {
    const text = '**TODO**: A\nA said TODO(AB): x\n'
    expect(renameTodoOwners(text, swap)).toEqual({ body: text, changed: 0 })
  })
  it('does not treat $ in initials as a pattern', () => {
    expect(renameTodoOwners('TODO(A): x', new Map([['A', "B$&'"]])).body).toBe("TODO(B$&'): x")
  })
})

function kathyName(name = 'Kathy Rastle', initials = 'KR'): { name: string; initials: string } {
  return { name, initials }
}
