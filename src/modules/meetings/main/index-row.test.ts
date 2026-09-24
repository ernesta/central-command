import { describe, expect, it } from 'vitest'
import { hashContent } from '../../../main/notes/guarded-file'
import { buildIndexRow } from './index-row'

const FILE = `---
series: Supervision
date: 2026-09-24
start: '14:00'
end: '15:00'
mode: online
attendees: [Kathy Rastle, Ernesta Orlovaitė]
---

## Summary

Went **well**; see [the plan](https://x.y).

## Notes

### Study 1

- Weights were applied twice.
`

describe('buildIndexRow', () => {
  it('reads front matter, summary and note text', () => {
    const row = buildIndexRow('research', '2026-09-24 Supervision', FILE)
    expect(row).toMatchObject({
      workspace: 'research',
      id: '2026-09-24 Supervision',
      series: 'Supervision',
      date: '2026-09-24',
      start: '14:00',
      end: '15:00',
      mode: 'online',
      attendees: ['Kathy Rastle', 'Ernesta Orlovaitė'],
      summary: 'Went well; see the plan.',
      problems: [],
      contentHash: hashContent(FILE)
    })
    expect(row.excerpt).toContain('Weights were applied twice.')
    expect(row.excerpt).not.toContain('series:')
  })

  it('records the TODOs in the note', () => {
    const row = buildIndexRow(
      'research',
      'x',
      '---\nseries: Other\ndate: 2026-01-02\n---\n## Previous TODOs\n- [ ] **TODO(KR)**: a\n## Notes\n- **TODO(EO)**: b\n'
    )
    expect(row.todos.map((t) => [t.kind, t.owners.join(), t.text, t.done])).toEqual([
      ['previous', 'KR', 'a', false],
      ['inline', 'EO', 'b', false]
    ])
  })

  it('has an empty summary when the section is missing or empty', () => {
    expect(
      buildIndexRow('research', 'x', '---\nseries: Other\ndate: 2026-01-02\n---\n## Notes\n')
        .summary
    ).toBe('')
    expect(
      buildIndexRow(
        'research',
        'x',
        '---\nseries: Other\ndate: 2026-01-02\n---\n## Summary\n\n## Notes\n'
      ).summary
    ).toBe('')
  })

  it('falls back to the file name date and says so', () => {
    const row = buildIndexRow('research', '2025-11-26 Supervision', '## Notes\n')
    expect(row.date).toBe('2025-11-26')
    expect(row.problems).toContain('Date taken from the file name')
    expect(row.problems).toContain('No front matter')
  })

  it('leaves the date empty when neither source is valid', () => {
    const row = buildIndexRow('research', 'Untitled', '---\nseries: Other\ndate: nope\n---\n')
    expect(row.date).toBe('')
    expect(row.problems).toEqual(['Invalid date: nope'])
  })

  it('does not mistake a heading inside code for the summary', () => {
    const row = buildIndexRow(
      'research',
      'x',
      '---\nseries: Other\ndate: 2026-01-02\n---\n```\n## Summary\nfake\n```\n'
    )
    expect(row.summary).toBe('')
  })
})
