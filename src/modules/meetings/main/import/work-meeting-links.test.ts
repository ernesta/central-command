import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  WORK_MEETING_LINKS,
  WORK_TIMER_LINKS,
  linkWorkMeetings,
  planNoteLink,
  planSessionLinks
} from './work-meeting-links'

const NOTE = '---\nseries: Impact\ndate: 2026-02-02\nattendees: [A, B]\n---\n\n## Notes\n- body\n'
const taskOf = (uid: string): { title: string; list: string } | null =>
  uid === 'gone0000' ? null : { title: `Task ${uid}`, list: 'Impact' }

describe('planNoteLink', () => {
  it('adds only the task line and leaves the rest byte for byte', () => {
    const plan = planNoteLink(NOTE, 'abc12345')
    expect(plan).toEqual({
      kind: 'link',
      next: NOTE.replace('attendees: [A, B]\n', 'attendees: [A, B]\ntask: abc12345\n')
    })
  })

  it('keeps a CRLF note in its own line break', () => {
    const crlf = NOTE.replace(/\n/g, '\r\n')
    const plan = planNoteLink(crlf, 'abc12345')
    expect(plan.kind).toBe('link')
    if (plan.kind === 'link') expect(plan.next.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('knows a note that is already linked, and never changes one that holds another task', () => {
    expect(planNoteLink(NOTE.replace('---\n\n', 'task: abc12345\n---\n\n'), 'abc12345').kind).toBe(
      'already'
    )
    expect(planNoteLink(NOTE.replace('---\n\n', 'task: other999\n---\n\n'), 'abc12345')).toEqual({
      kind: 'conflict',
      has: 'other999'
    })
  })
})

const YEAR = {
  version: 1,
  start: '2026-05-01',
  sessions: [
    { id: 'a8955001', date: '2026-10-05', label: 'L', minutes: 0 },
    { id: '6846d0c1', date: '2026-10-05', label: 'L', minutes: 0 },
    { id: 'other', date: '2026-10-05', label: 'M', minutes: 5, task: 'cc://task/zzz' }
  ],
  adjusts: []
}
const yearText = JSON.stringify(YEAR, null, 2) + '\n'

describe('planSessionLinks', () => {
  it('sets only the task on the named sessions', () => {
    const plan = planSessionLinks(yearText, ['a8955001', '6846d0c1'], 'liberia1')
    expect(plan.kind).toBe('link')
    if (plan.kind !== 'link') return
    const back = JSON.parse(plan.next)
    expect(back.sessions[0]).toEqual({ ...YEAR.sessions[0], task: 'cc://task/liberia1' })
    expect(back.sessions[1].task).toBe('cc://task/liberia1')
    expect(back.sessions[2]).toEqual(YEAR.sessions[2])
    expect(plan.next.endsWith('\n')).toBe(true)
  })

  it('refuses a session that has another task, or one that is missing, and finds nothing on a second run', () => {
    expect(planSessionLinks(yearText, ['other'], 'liberia1').kind).toBe('problem')
    expect(planSessionLinks(yearText, ['nope'], 'liberia1').kind).toBe('problem')
    const done = planSessionLinks(yearText, ['a8955001'], 'liberia1')
    if (done.kind !== 'link') throw new Error('expected a link')
    expect(planSessionLinks(done.next, ['a8955001'], 'liberia1').kind).toBe('already')
  })
})

describe('linkWorkMeetings', () => {
  let root: string
  const notes = (): string => join(root, 'notes', 'meetings', 'work')
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wml-'))
    mkdirSync(notes(), { recursive: true })
    mkdirSync(join(root, 'time', 'work'), { recursive: true })
    for (const { file } of WORK_MEETING_LINKS) writeFileSync(join(notes(), file), NOTE)
    writeFileSync(
      join(root, 'time', 'work', WORK_TIMER_LINKS.file),
      yearText.replace(/"other"/g, '"other"')
    )
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))
  const run = (apply: boolean): ReturnType<typeof linkWorkMeetings> =>
    linkWorkMeetings(root, apply, 'stamp', taskOf)

  it('a dry run changes nothing', () => {
    const r = run(false)
    expect(r.ok).toBe(true)
    expect(r.changed).toBe(WORK_MEETING_LINKS.length + 1)
    expect(readFileSync(join(notes(), WORK_MEETING_LINKS[0].file), 'utf8')).toBe(NOTE)
    expect(readdirSync(root)).not.toContain('backups')
  })

  it('applies, backs up first, and a second run finds nothing', () => {
    const r = run(true)
    expect(r.ok).toBe(true)
    expect(r.backup).toContain('work-meeting-links-stamp')
    const first = WORK_MEETING_LINKS[0]
    expect(readFileSync(join(notes(), first.file), 'utf8')).toContain(`task: ${first.uid}`)
    expect(readFileSync(join(r.backup as string, 'notes-meetings-work', first.file), 'utf8')).toBe(
      NOTE
    )
    expect(
      JSON.parse(readFileSync(join(root, 'time', 'work', WORK_TIMER_LINKS.file), 'utf8'))
        .sessions[0].task
    ).toBe(`cc://task/${WORK_TIMER_LINKS.uid}`)
    expect(readFileSync(join(r.backup as string, 'time-work', WORK_TIMER_LINKS.file), 'utf8')).toBe(
      yearText
    )
    const again = run(true)
    expect(again.changed).toBe(0)
    expect(again.backup).toBeNull()
  })

  it('writes nothing at all when one note holds another task', () => {
    const path = join(notes(), WORK_MEETING_LINKS[5].file)
    writeFileSync(path, NOTE.replace('---\n\n', 'task: other999\n---\n\n'))
    const r = run(true)
    expect(r.ok).toBe(false)
    expect(readFileSync(join(notes(), WORK_MEETING_LINKS[0].file), 'utf8')).toBe(NOTE)
    expect(readdirSync(root)).not.toContain('backups')
  })

  it('writes nothing when a task is not a live Work task or a note is missing', () => {
    const missing = linkWorkMeetings(root, true, 's', (uid) =>
      uid === 'jjfe8nag' ? null : taskOf(uid)
    )
    expect(missing.ok).toBe(false)
    expect(readFileSync(join(notes(), WORK_MEETING_LINKS[1].file), 'utf8')).toBe(NOTE)
    rmSync(join(notes(), WORK_MEETING_LINKS[2].file))
    expect(run(true).ok).toBe(false)
  })
})
