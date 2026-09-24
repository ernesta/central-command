import { describe, expect, it } from 'vitest'
import { parseMeta, splitNote } from '../../shared/front-matter'
import { parseTodos } from '../../shared/todos'
import { parseTopics } from '../../shared/topics'
import {
  parseAttendees,
  parseObsidianMeeting,
  planMeetingImport,
  seriesFor,
  type PlanInput,
  type PlannedMeeting
} from './meeting-import'

const SUPERVISOR = `#supervisor-meeting #meeting

**Date**: Nov 20, 2025
**Attendees**: Prof [[Kathy Rastle]], Ernesta Orlovaitė
## Previous Action Items
- [ ] **TODO(EO)**: Read the recommended papers on bootstrapping.
- [x] **TODO(EO)**: Investigate other potential datasets (e.g., South Africa).
## Notes
**Luminos Studentship Agreement**
- Miranda sent an updated agreement to [[Luminos]].
- FRiLL in Reading
\t- **TODO (EO)**: Plan to travel to Reading for FRiLL.
\t- **TODO(KR & AC)**: Send [[Ethics|the ethics form]] round.
- TODO: Somebody should book the room
`

const LOG = `Date of meeting
Type of contact
Online / in person
Duration
Comments / agreed action points
Initials
Nov 26, 2025
Visit
In person
60 min
Key topics: the Luminos agreement and admin. Key decisions: sign before Christmas.
AC
KR
EO
Dec 3, 2025
Teams
Online
30 min
Key topics: ethics.

KR
EO
`

const word = (date: string, start: string, end: string): string =>
  `${date} | ${start} – ${end}\nAttendees: x\nNotes\n`

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    obsidian: [
      { fileName: '2025 11 26 Supervisor Meeting.md', folder: 'Supervision', text: SUPERVISOR },
      {
        fileName: '2025 12 03 Supervisor Meeting.md',
        folder: 'Supervision',
        text: '#supervisor-meeting\n\n**Date**: Dec 3, 2025\n**Attendees**: Kathy Rastle, Ernesta Orlovaitė\n## Notes\n- Nothing much\n'
      },
      {
        fileName: '2025 11 03 Meeting with Matthew Jukes.md',
        folder: '',
        text: '#luminos #meeting\n\n**Date**: Nov 3, 2025\n**Attendees**: Matthew Jukes, Ernesta Orlovaitė\n## Notes\n- **TODO(MJ)**: Share the data\n'
      },
      {
        fileName: '2025 12 17 Rastle Lab Meeting.md',
        folder: '',
        text: '#meeting\n\n**Date**: Dec 17, 2025\n**Attendees**: Kathy Rastle, [[Mia Kim]]\n## Notes\n- Presented\n'
      },
      {
        fileName: '2026 06 23 Annual Review.md',
        folder: '',
        text: '#meeting\n\n**Date**: Jun 23, 2026\n**Attendees**: Ravi Menon\n## Notes\n- Went well\n'
      }
    ],
    wordNotes: [
      {
        fileName: '2025 11 26 Supervisor Meeting Notes.docx',
        text: word('November 26, 2025', '10:00', '11:00')
      },
      {
        fileName: '2025 12 03 Supervisor Meeting Notes.docx',
        text: word('December 3, 2025', '9:00', '9:45')
      },
      {
        fileName: '2025 12 17 Rastle Lab Meeting Notes.docx',
        text: word('December 17, 2025', '14:00', '15:00')
      },
      { fileName: '~$25 12 03 Supervisor Meeting Notes.docx', text: 'lock file junk' }
    ],
    logText: LOG,
    existing: [],
    ...over
  }
}

const imported = (plan: ReturnType<typeof planMeetingImport>): PlannedMeeting[] =>
  plan.items.filter((i): i is PlannedMeeting => i.status === 'import')
const byTarget = (plan: ReturnType<typeof planMeetingImport>, target: string): PlannedMeeting => {
  const item = imported(plan).find((i) => i.target === target)
  if (!item) throw new Error(`no import for ${target}: ${plan.items.map((i) => i.status).join()}`)
  return item
}

describe('reading a note', () => {
  it('reads tags, dates, attendees and the untouched body', () => {
    const n = parseObsidianMeeting({
      fileName: '2025 11 26 Supervisor Meeting.md',
      folder: 'Supervision',
      text: SUPERVISOR
    })
    expect(n).toMatchObject({
      date: '2025-11-26',
      headerDate: '2025-11-20',
      tags: ['supervisor-meeting', 'meeting'],
      attendees: ['Kathy Rastle', 'Ernesta Orlovaitė'],
      series: 'Supervision',
      problems: []
    })
    expect(n.body.startsWith('## Previous Action Items\n')).toBe(true)
    expect(n.body).toContain('\t- **TODO (EO)**: Plan to travel')
  })
  it('stops at the first line it does not know, leaving it in the body', () => {
    const n = parseObsidianMeeting({
      fileName: '2025 01 02 Meeting with X.md',
      folder: '',
      text: '#luminos\n**Date**: Jan 2, 2025\n**Location**: Zoom\n**Attendees**: A B\nText'
    })
    expect(n.body).toBe('**Location**: Zoom\n**Attendees**: A B\nText')
    expect(n.attendees).toEqual([])
    expect(n.problems).toContain('No Attendees line')
  })
  it('reports a missing or unreadable date', () => {
    expect(
      parseObsidianMeeting({ fileName: 'Untitled.md', folder: '', text: 'x' }).problems[0]
    ).toContain('does not start with a date')
    expect(
      parseObsidianMeeting({
        fileName: '2025 01 02 X.md',
        folder: '',
        text: '**Date**: sometime\n'
      }).problems
    ).toContain('The Date line could not be read: "sometime"')
  })
  it('cleans attendee names', () => {
    expect(
      parseAttendees(
        'Prof [[Kathy Rastle]], Dr. Arnaud Chevalier; [[People/EO|Ernesta Orlovaitė]], kathy rastle'
      )
    ).toEqual(['Kathy Rastle', 'Arnaud Chevalier', 'Ernesta Orlovaitė'])
  })
  it('works out the series from folder, tags and name, and says nothing when it cannot', () => {
    expect(seriesFor('x', ['supervisor-meeting'], '')).toBe('Supervision')
    expect(seriesFor('x', [], 'Supervision')).toBe('Supervision')
    expect(seriesFor('2025 12 17 Rastle Lab Meeting.md', ['meeting'], '')).toBe('Rastle Lab')
    expect(seriesFor('x', ['luminos'], '')).toBe('Luminos')
    expect(seriesFor('2026 06 23 Annual Review.md', [], '')).toBe('Other')
    expect(seriesFor('2025 01 01 Coffee.md', ['meeting'], '')).toBeNull()
  })
})

describe('planMeetingImport', () => {
  const plan = planMeetingImport(input())

  it('imports every note, named after its date and series', () => {
    expect(
      imported(plan)
        .map((i) => i.target)
        .sort()
    ).toEqual([
      '2025-11-03 Luminos.md',
      '2025-11-26 Supervision.md',
      '2025-12-03 Supervision.md',
      '2025-12-17 Rastle Lab.md',
      '2026-06-23 Other.md'
    ])
    expect(plan.items.every((i) => i.status === 'import')).toBe(true)
    expect(plan.anomalies).toEqual([])
  })

  it('takes times from the Word note (padding a one-digit hour) and type and summary from the log', () => {
    const m = byTarget(plan, '2025-11-26 Supervision.md')
    expect(m.meta).toMatchObject({
      start: '10:00',
      end: '11:00',
      mode: 'in-person',
      series: 'Supervision',
      date: '2025-11-26'
    })
    expect(byTarget(plan, '2025-12-03 Supervision.md').meta).toMatchObject({
      start: '09:00',
      end: '09:45',
      mode: 'online'
    })
    expect(
      splitNote(m.content).body.startsWith(
        '## Summary\n\nKey topics: the Luminos agreement and admin. Key decisions: sign before Christmas.\n\n'
      )
    ).toBe(true)
  })

  it('matches the Rastle Lab Word note to the Rastle Lab meeting', () => {
    expect(byTarget(plan, '2025-12-17 Rastle Lab.md').meta).toMatchObject({
      start: '14:00',
      end: '15:00',
      mode: null
    })
  })

  it('uses the file name date when the Date line disagrees, and reminds', () => {
    expect(byTarget(plan, '2025-11-26 Supervision.md').notes.join(' ')).toContain(
      'Date line says 2025-11-20'
    )
    expect(plan.reminders.dateMismatches).toEqual([
      {
        source: '2025 11 26 Supervisor Meeting.md',
        headerDate: '2025-11-20',
        usedDate: '2025-11-26'
      }
    ])
  })

  it('reminds about a duration that differs between the log and the Word note, and uses the note', () => {
    expect(plan.reminders.durationMismatches).toEqual([
      { date: '2025-12-03', logMinutes: 30, noteMinutes: 45 }
    ])
    expect(byTarget(plan, '2025-12-03 Supervision.md').meta.end).toBe('09:45')
  })

  it('reminds about meetings with no times, and leaves them without', () => {
    expect(plan.reminders.noTimes.map((n) => n.source).sort()).toEqual([
      '2025 11 03 Meeting with Matthew Jukes.md',
      '2026 06 23 Annual Review.md'
    ])
    expect(byTarget(plan, '2025-11-03 Luminos.md').meta).toMatchObject({ start: null, end: null })
  })

  it('writes attendees as full names, without titles or wikilinks', () => {
    expect(byTarget(plan, '2025-11-26 Supervision.md').meta.attendees).toEqual([
      'Kathy Rastle',
      'Ernesta Orlovaitė'
    ])
    expect(byTarget(plan, '2025-12-17 Rastle Lab.md').meta.attendees).toEqual([
      'Kathy Rastle',
      'Mia Kim'
    ])
  })

  it('writes a note that reads back the same and is in the standard shape', () => {
    const m = byTarget(plan, '2025-11-26 Supervision.md')
    const { head, body } = splitNote(m.content)
    expect(parseMeta(head)).toMatchObject({
      problems: [],
      meta: { start: '10:00', mode: 'in-person' }
    })
    expect(body).toContain('## Previous TODOs')
    expect(body).not.toContain('Previous Action Items')
    expect(body).not.toContain('[[')
    expect(body).not.toContain('\t')
    expect(body.endsWith('\n')).toBe(true)
    // The other meetings get an empty Summary to fill in.
    expect(
      splitNote(byTarget(plan, '2025-11-03 Luminos.md').content).body.startsWith(
        '## Summary\n\n## Notes\n'
      )
    ).toBe(true)
  })

  it('leaves every TODO exactly as written (owners, spelling, text), whatever the note holds', () => {
    const body = splitNote(byTarget(plan, '2025-11-26 Supervision.md').content).body
    const todos = parseTodos(body).map((t) => [t.owners.join('&'), t.text, t.done])
    expect(todos).toEqual([
      ['EO', 'Read the recommended papers on bootstrapping.', false],
      ['EO', 'Investigate other potential datasets (e.g., South Africa).', true],
      ['EO', 'Plan to travel to Reading for FRiLL.', false],
      ['KR&AC', 'Send the ethics form round.', false],
      ['', 'Somebody should book the room', false]
    ])
    expect(body).toContain('**TODO (EO)**: Plan to travel to Reading for FRiLL.')
  })
})

describe('planMeetingImport: safety', () => {
  it('never touches a meeting that is already there, however it is named', () => {
    const p = planMeetingImport(
      input({ existing: [{ fileName: 'old name.md', date: '2025-11-26', series: 'Supervision' }] })
    )
    const skipped = p.items.find((i) => i.status === 'skip-exists')
    expect(skipped).toMatchObject({
      source: '2025 11 26 Supervisor Meeting.md',
      target: 'old name.md'
    })
    expect(imported(p).map((i) => i.target)).not.toContain('2025-11-26 Supervision.md')
  })

  it('running it again after a full import writes nothing', () => {
    const first = planMeetingImport(input())
    const existing = imported(first).map((i) => ({
      fileName: i.target,
      date: i.meta.date,
      series: i.meta.series
    }))
    const second = planMeetingImport(input({ existing }))
    expect(imported(second)).toEqual([])
    expect(second.items.every((i) => i.status === 'skip-exists')).toBe(true)
  })

  it('does not pick a file name that is already taken', () => {
    const p = planMeetingImport(
      input({ existing: [{ fileName: '2025-11-26 Supervision.md', date: '', series: '' }] })
    )
    expect(imported(p).map((i) => i.target)).toContain('2025-11-26 Supervision 2.md')
  })

  it('reports two notes for the same series and day instead of guessing', () => {
    const dup = {
      fileName: '2025 11 26 Supervisor Meeting copy.md',
      folder: 'Supervision',
      text: SUPERVISOR
    }
    const base = input()
    const p = planMeetingImport({ ...base, obsidian: [...base.obsidian, dup] })
    const attention = p.items.filter((i) => i.status === 'attention')
    expect(attention).toHaveLength(1)
    expect(imported(p).filter((i) => i.meta.date === '2025-11-26')).toHaveLength(1)
  })

  it('leaves out a note whose series cannot be worked out, and one with no date in its name', () => {
    const p = planMeetingImport({
      ...input(),
      obsidian: [
        {
          fileName: '2025 01 01 Coffee.md',
          folder: '',
          text: '#meeting\n**Date**: Jan 1, 2025\n**Attendees**: A B\n- x\n'
        },
        { fileName: 'Untitled.md', folder: '', text: 'x' }
      ]
    })
    expect(p.items.map((i) => i.status)).toEqual(['attention', 'attention'])
    expect(imported(p)).toEqual([])
  })

  it('reports Word notes and log rows that match no meeting note, and ignores Word lock files', () => {
    const base = input()
    const p = planMeetingImport({
      ...base,
      wordNotes: [
        ...base.wordNotes,
        {
          fileName: '2025 09 09 Supervisor Meeting Notes.docx',
          text: word('September 9, 2025', '10:00', '11:00')
        }
      ],
      logText: LOG + 'Sep 9, 2025\nVisit\nIn person\n30 min\nSomething.\nKR\n'
    })
    expect(p.anomalies.some((a) => a.includes('2025 09 09 Supervisor Meeting Notes.docx'))).toBe(
      true
    )
    expect(p.anomalies.some((a) => a.includes('Log row for 2025-09-09'))).toBe(true)
    expect(p.anomalies.some((a) => a.includes('~$'))).toBe(false)
  })

  it('reports a Word note whose own first line disagrees with its file name, and takes no times from it', () => {
    const base = input()
    const p = planMeetingImport({
      ...base,
      wordNotes: [
        {
          fileName: '2025 11 26 Supervisor Meeting Notes.docx',
          text: word('November 27, 2025', '10:00', '11:00')
        }
      ]
    })
    expect(p.anomalies.join(' ')).toContain('its first line says 2025-11-27')
    expect(byTarget(p, '2025-11-26 Supervision.md').meta.start).toBeNull()
  })

  it('works without a log or Word notes at all', () => {
    const p = planMeetingImport({ ...input(), wordNotes: [], logText: null })
    expect(imported(p)).toHaveLength(5)
    expect(byTarget(p, '2025-11-26 Supervision.md').meta).toMatchObject({ start: null, mode: null })
    expect(p.reminders.noTimes).toHaveLength(5)
  })

  it('keeps a Notes heading that is followed straight by a topic heading (so the topics stay topics)', () => {
    const p = planMeetingImport({
      ...input(),
      obsidian: [
        {
          fileName: '2026 07 09 Supervisor Meeting.md',
          folder: 'Supervision',
          text: '#supervisor-meeting\n\n**Date**: Jul 9, 2026\n**Attendees**: A B\n## Notes\n### Updates\n- FRILL tomorrow\n### Study 1 Paper\n- Feedback\n'
        }
      ],
      wordNotes: [],
      logText: 'Jul 9, 2026\nTeams\nOnline\n60 min\nKey topics: the paper.\nKR\nEO\n'
    })
    const body = splitNote(byTarget(p, '2026-07-09 Supervision.md').content).body
    expect(body).toBe(
      '## Summary\n\nKey topics: the paper.\n\n## Notes\n\n### Updates\n\n- FRILL tomorrow\n\n### Study 1 Paper\n\n- Feedback\n'
    )
    expect(parseTopics(body).map((t) => t.text)).toEqual(['Updates', 'Study 1 Paper'])
  })

  it('imports previous items with a status word in front, keeping their text', () => {
    const p = planMeetingImport({
      ...input(),
      obsidian: [
        {
          fileName: '2025 11 20 Supervisor Meeting.md',
          folder: 'Supervision',
          text: '#supervisor-meeting\n\n**Date**: Nov 20, 2025\n**Attendees**: A B\n## Previous Action Items\n- [x] **TODO(EO)**: Done one.\n- [ ] (Cancelled) **TODO(EO)**: Investigate datasets.\n- [ ] (In Progress) **TODO(EO)**: Update the plan.\n## Notes\n- x\n'
        }
      ],
      wordNotes: [],
      logText: null
    })
    const body = splitNote(byTarget(p, '2025-11-20 Supervision.md').content).body
    expect(body).toContain('- [ ] (Cancelled) **TODO(EO)**: Investigate datasets.')
    expect(body).toContain('- [ ] (In Progress) **TODO(EO)**: Update the plan.')
    expect(body).toContain('- [x] **TODO(EO)**: Done one.')
  })

  it('leaves a note out if the conversion changes what is ticked', () => {
    const untick = (body: string): { markdown: string } => ({
      markdown: body.replace('- [x]', '- [ ]')
    })
    const p = planMeetingImport({ ...input(), transform: untick })
    expect(p.items.some((i) => i.status === 'attention' && i.source.startsWith('2025 11 26'))).toBe(
      true
    )
  })

  it('leaves a note out, writing nothing, if the conversion ever loses or changes a TODO', () => {
    const drop = (body: string): { markdown: string } => ({
      markdown: body
        .split('\n')
        .filter((l) => !l.includes('Plan to travel'))
        .join('\n')
    })
    const change = (body: string): { markdown: string } => ({
      markdown: body.replace('Somebody should', 'Somebody could')
    })
    for (const transform of [drop, change]) {
      const p = planMeetingImport({ ...input(), transform })
      const bad = p.items.find((i) => i.status === 'attention' && i.source.startsWith('2025 11 26'))
      expect(bad).toBeDefined()
      expect(imported(p).map((i) => i.meta.date)).not.toContain('2025-11-26')
    }
  })

  it('also leaves a note out if the conversion adds a TODO that was not there', () => {
    const add = (body: string): { markdown: string } => ({
      markdown: `${body}\n- **TODO(EO)**: invented\n`
    })
    const p = planMeetingImport({ ...input(), transform: add })
    expect(p.items.every((i) => i.status === 'attention')).toBe(true)
  })

  it('gives a Supervision meeting and a Rastle Lab meeting on the same day their own Word notes', () => {
    const base = input()
    const p = planMeetingImport({
      ...base,
      obsidian: [
        {
          fileName: '2025 12 03 Supervisor Meeting.md',
          folder: 'Supervision',
          text: '#supervisor-meeting\n\n**Date**: Dec 3, 2025\n**Attendees**: A B\n- x\n'
        },
        {
          fileName: '2025 12 03 Rastle Lab Meeting.md',
          folder: '',
          text: '#meeting\n\n**Date**: Dec 3, 2025\n**Attendees**: A B\n- y\n'
        }
      ],
      wordNotes: [
        {
          fileName: '2025 12 03 Supervisor Meeting Notes.docx',
          text: word('December 3, 2025', '9:00', '9:45')
        },
        {
          fileName: '2025 12 03 Rastle Lab Meeting Notes.docx',
          text: word('December 3, 2025', '14:00', '15:00')
        }
      ],
      logText: null
    })
    expect(byTarget(p, '2025-12-03 Supervision.md').meta.start).toBe('09:00')
    expect(byTarget(p, '2025-12-03 Rastle Lab.md').meta.start).toBe('14:00')
    expect(p.anomalies).toEqual([])
  })

  it('never loses a TODO across many differently shaped notes (generated)', () => {
    const pieces = [
      '## Previous Action Items',
      '- [ ] **TODO(EO)**: carried [[Link]] item',
      '- [x] **TODO (KR)**: done thing',
      '## Notes',
      '### A topic',
      '**A bold pseudo-heading**',
      '- plain bullet',
      '\t- nested **TODO(EO & KR)**: nested todo',
      '- TODO: no owner',
      '- **TODO(MJ)**: tabs\there',
      '  ',
      '- ',
      '```',
      '**TODO(ZZ)**: inside code is not a TODO',
      'Some text with [[Page|shown]] and trailing spaces   '
    ]
    let seed = 7
    const rnd = (n: number): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n)
    for (let n = 0; n < 400; n++) {
      const text =
        '#supervisor-meeting\n\n**Date**: Jan 1, 2026\n**Attendees**: A B\n' +
        Array.from({ length: 1 + rnd(14) }, () => pieces[rnd(pieces.length)]).join('\n') +
        '\n'
      const p = planMeetingImport({
        obsidian: [{ fileName: '2026 01 02 Supervisor Meeting.md', folder: 'Supervision', text }],
        wordNotes: [],
        logText: null,
        existing: []
      })
      const item = p.items[0]
      expect(item.status, JSON.stringify(text)).toBe('import')
      if (item.status !== 'import') continue
      const before = parseTodos(
        text
          .split('\n')
          .slice(4)
          .join('\n')
          .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
          .replace(/\[\[([^\]]+)\]\]/g, '$1')
      )
      const after = parseTodos(splitNote(item.content).body)
      for (const b of before) {
        expect(
          after.some(
            (a) => a.text === b.text && a.owners.join() === b.owners.join() && a.done === b.done
          )
        ).toBe(true)
      }
    }
  })
})
