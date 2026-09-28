import { describe, expect, it } from 'vitest'
import { parseMeta, splitNote } from '../../shared/front-matter'
import { planWorkMeetingImport, type PlannedWorkMeeting } from './work-meeting-import'

const ACTION_ITEMS = `**Date**: Jul 3, 2026
**Attendees**: Neha Raheel, Amrita Gopal, Ernesta Orlovaitė
## Action items
- **TODO(NR)**: Share previous conversations with Fab AI.
- TOOD(EO): Start drafting detailed user requirements and acceptance criteria.
## Notes
### General updates
Fab Inc has changed its name to Fab AI.
`

const AGENDA_ONLY = `**Date**: Oct 6, 2025
**Attendees**: [[Matthew Jukes]], Ernesta Orlovaitė
## Agenda
* Data system design plan
## Notes
* **TODO (Matthew)**: Review the Luminos Data System High-Level Plan document and provide further comments.
* **Decision**: Data system design to cover all 4 data streams.
`

const TOPIC_ONLY = `**Date**: Mar 12, 2026
**Attendees**: Biruke Wesenseged, Bisrat Awoke
## Topic
- EGRA/EGMA Pipeline Design
## Notes
- Decision: use Azure Logic Apps for email notifications
`

function firstImport(text: string, fileName: string, folder: string): PlannedWorkMeeting {
  const plan = planWorkMeetingImport({
    obsidian: [{ fileName, folder, text }],
    existing: []
  })
  const item = plan.items[0]
  if (item.status !== 'import') throw new Error(`expected an import, got ${item.status}`)
  return item
}

describe('planWorkMeetingImport', () => {
  it('uses the sub-folder as the series, and the file name date', () => {
    const item = firstImport(
      ACTION_ITEMS,
      '2026 07 03 Luminos (Neha, Amrita).md',
      'Teaching & Learning'
    )
    expect(item.meta.series).toBe('Teaching & Learning')
    expect(item.meta.date).toBe('2026-07-03')
    expect(item.meta.attendees).toEqual(['Neha Raheel', 'Amrita Gopal', 'Ernesta Orlovaitė'])
    expect(item.meta.start).toBeNull()
    expect(item.meta.end).toBeNull()
  })

  it('fixes a "TOOD" typo and reports it, keeping the TODO recognisable', () => {
    const item = firstImport(ACTION_ITEMS, '2026 07 03 x.md', 'Teaching & Learning')
    expect(item.content).toContain('TODO(EO)')
    expect(item.content).not.toContain('TOOD')
    expect(item.notes.some((n) => /Fixed 1 "TOOD" typo/.test(n))).toBe(true)
  })

  it('handles a note with no "Action items" heading, just Agenda and Notes, with a full-name TODO owner', () => {
    const item = firstImport(AGENDA_ONLY, '2025 10 06 Luminos (Matthew).md', 'Impact')
    expect(item.meta.series).toBe('Impact')
    expect(item.content).toContain('TODO (Matthew)')
    expect(item.content).toContain('Decision')
    // The wikilink became plain text.
    expect(item.content).toContain('Matthew Jukes')
    expect(item.content).not.toContain('[[')
  })

  it('handles a note with only a "Topic" heading (no Action items, no Agenda)', () => {
    const item = firstImport(TOPIC_ONLY, '2026 03 12 x.md', 'Impact')
    expect(item.content).toContain('EGRA/EGMA Pipeline Design')
    expect(item.content).toContain('Azure Logic Apps')
  })

  it('reads the front matter back the same it wrote', () => {
    const item = firstImport(ACTION_ITEMS, '2026 07 03 x.md', 'Teaching & Learning')
    const back = parseMeta(splitNote(item.content).head).meta
    expect(back.series).toBe(item.meta.series)
    expect(back.date).toBe(item.meta.date)
    expect(back.attendees).toEqual(item.meta.attendees)
  })

  it('flags a note whose file name has no date, instead of guessing one', () => {
    const plan = planWorkMeetingImport({
      obsidian: [{ fileName: 'Untitled.md', folder: 'Impact', text: 'Just some prose.\n' }],
      existing: []
    })
    expect(plan.items[0]).toMatchObject({ status: 'attention' })
  })

  it('imports from the file name date even with no Date or Attendees line, noting what is missing', () => {
    const item = firstImport('Just some prose.\n', '2026 01 01 x.md', 'Impact')
    expect(item.meta.date).toBe('2026-01-01')
    expect(item.meta.attendees).toEqual([])
    expect(item.notes).toEqual(expect.arrayContaining(['No Date line', 'No Attendees line']))
  })

  // A mutation check (CLAUDE.md: safety-critical logic should be deliberately broken to confirm a test
  // catches it): a conversion that drops a TODO must never be written.
  it('refuses to import when the conversion drops a TODO, via an injected bad transform', () => {
    const dropTodos = (body: string): { markdown: string } => ({
      markdown: body.replace(/^.*TODO.*$/gm, '')
    })
    const plan = planWorkMeetingImport({
      obsidian: [
        { fileName: '2026 07 03 x.md', folder: 'Teaching & Learning', text: ACTION_ITEMS }
      ],
      existing: [],
      transform: dropTodos
    })
    expect(plan.items[0]).toMatchObject({ status: 'attention' })
  })

  it('imports two distinct meetings on the same date and series, named apart with a numeric suffix', () => {
    const plan = planWorkMeetingImport({
      obsidian: [
        {
          fileName: '2025 11 04 Luminos (Biruke, William).md',
          folder: 'Impact',
          text: '**Date**: Nov 4, 2025\n**Attendees**: Biruke Wesenseged, William\n## Notes\nFirst.\n'
        },
        {
          fileName: '2025 11 04 Luminos (Brian, Edward).md',
          folder: 'Impact',
          text: '**Date**: Nov 4, 2025\n**Attendees**: Brian, Edward\n## Notes\nSecond.\n'
        }
      ],
      existing: []
    })
    expect(plan.items).toHaveLength(2)
    const [first, second] = plan.items
    if (first.status !== 'import' || second.status !== 'import') {
      throw new Error(`expected both to import, got ${first.status}, ${second.status}`)
    }
    expect(first.target).toBe('2025-11-04 Impact.md')
    expect(second.target).toBe('2025-11-04 Impact 2.md')
    expect(first.meta.attendees).toEqual(['Biruke Wesenseged', 'William'])
    expect(second.meta.attendees).toEqual(['Brian', 'Edward'])
    expect(second.notes.some((n) => /Also Impact on 2025-11-04/.test(n))).toBe(true)
  })

  it('skips a note whose target already exists, never touching it', () => {
    const plan = planWorkMeetingImport({
      obsidian: [
        { fileName: '2026 07 03 x.md', folder: 'Teaching & Learning', text: ACTION_ITEMS }
      ],
      existing: [{ fileName: '2026-07-03 Teaching & Learning.md' }]
    })
    // The target name a fresh run would pick already exists as far as the caller told us; the store's own
    // exclusive-create is still the real guard (see the store's mutation checks), but the plan should not
    // pretend a taken name is free.
    const item = plan.items[0]
    expect(item.status === 'import' ? item.target : '').not.toBe(
      '2026-07-03 Teaching & Learning.md'
    )
  })
})
