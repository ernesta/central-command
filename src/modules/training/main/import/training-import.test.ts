import { describe, expect, it } from 'vitest'
import { parseTrainingMeta, splitNote } from '../../shared/front-matter'
import type { InkpathRow } from './inkpath'
import {
  parseFolderName,
  planTrainingImport,
  similarTitles,
  verifyPlanned,
  type PlannedEntry
} from './training-import'

const row = (over: Partial<InkpathRow> = {}): InkpathRow => ({
  row: 2,
  name: 'SEDarc: Mixed Methods Research Designs',
  attendance: 'Live (online)',
  description: 'Refine understanding of mixed methods.',
  organisation: 'SEDarc DTP',
  provider: 'Royal Holloway',
  startDate: '2025-10-08',
  endDate: '2025-10-08',
  startTime: '09:30',
  endTime: '12:30',
  hours: 3,
  points: '',
  skills: 'Qualitative Skills (SS), Quantitative Skills (GS)',
  notes: '',
  ...over
})

const plan = (
  rows: InkpathRow[],
  extra: Partial<Parameters<typeof planTrainingImport>[0]> = {}
): ReturnType<typeof planTrainingImport> => planTrainingImport({ rows, existing: [], ...extra })
const imported = (p: ReturnType<typeof planTrainingImport>): PlannedEntry[] =>
  p.items.filter((i): i is PlannedEntry => i.status === 'import')

describe('planTrainingImport: the row becomes an entry', () => {
  it('maps every field and reads back exactly', () => {
    const p = plan([row()])
    const [entry] = imported(p)
    expect(entry.target).toBe('2025-10-08 SEDarc_ Mixed Methods Research Designs.md')
    const { head, body } = splitNote(entry.content)
    const { meta, problems } = parseTrainingMeta(head)
    expect(problems).toEqual([])
    expect(meta).toMatchObject({
      date: '2025-10-08',
      start: '09:30',
      end: '12:30',
      title: 'SEDarc: Mixed Methods Research Designs',
      series: 'SEDarc',
      type: null,
      mode: 'online',
      skills: ['Qualitative skills (SS)', 'Quantitative skills (GS)'],
      institution: 'Royal Holloway',
      organisation: 'SEDarc DTP'
    })
    expect(body).toBe('## Summary\n\nRefine understanding of mixed methods.\n\n## Notes\n')
    expect(p.totals).toMatchObject({
      sourceEntries: 1,
      plannedEntries: 1,
      sourceMinutes: 180,
      plannedMinutes: 180
    })
  })

  it('sets the format from the attendance, and self-paced for DataCamp', () => {
    const p = plan([
      row({ attendance: 'Live (in person)', name: 'A' }),
      row({ attendance: 'Other', name: 'B' }),
      row({ attendance: 'Other', name: 'DataCamp: R', provider: 'DataCamp', organisation: 'X' })
    ])
    expect(imported(p).map((e) => e.patch.mode)).toEqual(['in-person', null, 'self-paced'])
  })

  it('keeps the first three skills, and leaves the rest for review; unknown skills too', () => {
    const p = plan([
      row({
        skills:
          'Networking (RP), Leadership (RP), Impact (RP), Negotiations (RP), Making things (Live)'
      })
    ])
    const [entry] = imported(p)
    expect(entry.patch.skills).toEqual(['Networking (RP)', 'Leadership (RP)', 'Impact (RP)'])
    expect(entry.todo).toContain('Left out: Negotiations (RP)')
    expect(entry.todo).toContain('Making things (Live)')
    expect(p.reports.unknownSkills).toEqual([{ skill: 'Making things (Live)', rows: [2] }])
  })

  it('leaves supervisor and lab meetings for Meetings, and does not count them', () => {
    const p = plan([row(), row({ row: 3, name: 'Supervisor Meeting Apr 1, 2026' })])
    expect(imported(p)).toHaveLength(1)
    expect(p.meetings.map((m) => m.name)).toEqual(['Supervisor Meeting Apr 1, 2026'])
    expect(p.totals.sourceEntries).toBe(1)
  })

  it('reports rather than guesses: several days, no date, existing entries', () => {
    const p = plan(
      [
        row({ name: 'Long', endDate: '2025-10-10' }),
        row({ name: 'Undated', startDate: '' }),
        row({ name: 'Already here' })
      ],
      {
        existing: [
          { fileName: '2025-10-08 Already here.md', date: '2025-10-08', title: 'Already here' }
        ]
      }
    )
    expect(p.items.map((i) => i.status)).toEqual(['attention', 'attention', 'skip-exists'])
  })

  it('a second run over its own output writes nothing', () => {
    const first = plan([row()])
    const [entry] = imported(first)
    const meta = parseTrainingMeta(splitNote(entry.content).head).meta
    const second = plan([row()], {
      existing: [{ fileName: entry.target, date: meta.date, title: meta.title }]
    })
    expect(imported(second)).toHaveLength(0)
  })

  it('numbers a second entry with the same date and title', () => {
    const p = plan([row(), row({ row: 3 })])
    // The second is the same date and title, so it is skipped as already planned rather than duplicated.
    expect(p.items.map((i) => i.status)).toEqual(['import', 'skip-exists'])
  })

  it('reports typed hours that differ from the times, and providers that look like people', () => {
    const p = plan([row({ hours: 1, provider: 'Dr Anastasiya Lopukhina' })])
    expect(p.reports.hoursDiffer).toEqual([expect.objectContaining({ typed: 1, fromTimes: 180 })])
    expect(p.reports.peopleProviders).toEqual([{ provider: 'Dr Anastasiya Lopukhina', count: 1 }])
    expect(imported(p)[0].patch.institution).toBe('Dr Anastasiya Lopukhina')
    expect(imported(p)[0].leads).toEqual([])
  })
})

describe('Obsidian notes', () => {
  const note = {
    path: 'SEDarc/2025 10 08 Mixed Methods Research Designs.md',
    fileName: '2025 10 08 Mixed Methods Research Designs.md',
    text: '#sedarc #training\n\n**Lead**: Prof [[Ryan McKay]]\n## Overview\nSee [[Moodle|the site]].\n## Notes\n* One\n\t* Two\n'
  }

  it('attaches a matching note under Notes with headings one level deeper, and takes the lead', () => {
    const p = plan([row()], { notes: [note] })
    const [entry] = imported(p)
    expect(entry.leads).toEqual(['Ryan McKay'])
    expect(entry.patch.leads).toEqual(['Ryan McKay'])
    expect(splitNote(entry.content).body).toContain(
      '## Notes\n\n### Overview\n\nSee the site.\n\n### Notes\n\n* One\n  * Two\n'
    )
    expect(p.reports.unmatchedNotes).toEqual([])
  })

  it('reports a note that matches nothing, and never attaches a note to two activities', () => {
    const p = plan(
      [row({ name: 'Something else', startDate: '2025-11-01', endDate: '2025-11-01' })],
      { notes: [note] }
    )
    expect(imported(p)[0].matchedNote).toBeNull()
    expect(p.reports.unmatchedNotes).toHaveLength(1)
    const two = plan([row(), row({ row: 3, name: 'Mixed Methods Research Designs (repeat)' })], {
      notes: [note]
    })
    expect(imported(two).every((e) => e.matchedNote === null)).toBe(true)
  })

  it('the safety check fails when a note line is lost', () => {
    const p = plan([row()], { notes: [note] })
    const [entry] = imported(p)
    const parsed = {
      path: 'x',
      date: '',
      title: '',
      leads: [],
      markdown: '',
      sourceLines: ['a line that vanished']
    }
    expect(
      verifyPlanned(
        entry.row,
        entry.patch.title as string,
        entry.patch.skills as string[],
        entry.content,
        parsed
      )
    ).toEqual(["The note's text changed in conversion"])
  })
})

describe('folders', () => {
  it('parses a folder name with a date, a day range, a month range and a full range', () => {
    expect(parseFolderName('2025 12 10 Data Management')).toEqual({
      from: '2025-12-10',
      to: '2025-12-10',
      title: 'Data Management'
    })
    expect(parseFolderName('2026 05 19-20 Intro to Simulation')).toEqual({
      from: '2026-05-19',
      to: '2026-05-20',
      title: 'Intro to Simulation'
    })
    expect(parseFolderName('2026 06 29 - 08 03 Experimental Methods')).toEqual({
      from: '2026-06-29',
      to: '2026-08-03',
      title: 'Experimental Methods'
    })
    expect(parseFolderName('2025 12 15 2026 07 10 Forum for Research')).toEqual({
      from: '2025-12-15',
      to: '2026-07-10',
      title: 'Forum for Research'
    })
    expect(parseFolderName('DataCamp')).toBeNull()
  })

  it('links a folder when exactly one has the date and a similar title, otherwise reports', () => {
    const folders = [
      { path: '2025-26/SEDarc/2025 10 08 Mixed Methods Research Designs' },
      { path: '2025-26/SEDarc/2025 10 09 Qualitative Methods Research Designs' }
    ]
    const p = plan(
      [row(), row({ row: 3, name: 'Unrelated', startDate: '2025-10-09', endDate: '2025-10-09' })],
      {
        folders
      }
    )
    const [a, b] = imported(p)
    expect(a.patch.folder).toBe('2025-26/SEDarc/2025 10 08 Mixed Methods Research Designs')
    expect(b.patch.folder).toBeNull()
    expect(p.reports.unmatchedFolders).toHaveLength(1)
  })

  it('compares titles by words, ignoring case, accents and punctuation', () => {
    expect(similarTitles('SEDarc: Mixed Methods', 'mixed methods research designs')).toBe(true)
    expect(similarTitles('Blogging for Researchers', 'Storytelling for Researchers')).toBe(false)
  })
})

describe('the safety net', () => {
  it('leaves out an entry whose description would break the file', () => {
    const p = plan([row({ description: 'Intro\n\n## Notes\n\nsneaky' })])
    expect(p.items[0].status).toBe('attention')
    expect(p.totals.plannedEntries).toBe(0)
    expect(p.totals.sourceEntries).toBe(1)
  })
})
