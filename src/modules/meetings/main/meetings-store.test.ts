import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { hashContent } from '../../../main/notes/guarded-file'
import { splitNote } from '../shared/front-matter'
import type { MeetingRef } from '../shared/types'
import { meetingsMigrations } from './migrations'
import { MeetingError, MeetingsStore } from './meetings-store'
import { getMeetingRow, listMeetingIds } from './repository'

let root: string
let dir: string
let db: Database.Database
let store: MeetingsStore
const file = (id: string): string => join(dir, `${id}.md`)
const disk = (id: string): string => readFileSync(file(id), 'utf8')
const ref = (id: string): MeetingRef => ({ workspace: 'research', id })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-meetings-'))
  dir = join(root, 'research')
  db = new Database(':memory:')
  runMigrations(db, meetingsMigrations)
  store = new MeetingsStore({ db, dirFor: (w) => join(root, w) })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('create', () => {
  it('writes the template with front matter and indexes it', async () => {
    const meeting = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24',
      start: '14:00',
      end: '15:00',
      mode: 'in-person',
      attendees: ['Kathy Rastle', 'Ernesta Orlovaitė']
    })
    expect(meeting.ref).toEqual(ref('2026-09-24 Supervision'))
    expect(disk('2026-09-24 Supervision')).toBe(
      "---\nseries: Supervision\ndate: 2026-09-24\nstart: '14:00'\nend: '15:00'\nmode: in-person\nattendees: [Kathy Rastle, Ernesta Orlovaitė]\n---\n\n## Summary\n\n## Previous TODOs\n\n## Notes\n"
    )
    expect(meeting.meta).toMatchObject({
      series: 'Supervision',
      date: '2026-09-24',
      start: '14:00'
    })
    expect(meeting.problems).toEqual([])
    expect(meeting.note.hash).toBe(hashContent(disk('2026-09-24 Supervision')))
    expect(getMeetingRow(db, 'research', '2026-09-24 Supervision')?.series).toBe('Supervision')
  })

  it('creates the folder on first use and takes a given body verbatim', async () => {
    const m = await store.create({
      workspace: 'research',
      series: 'Other',
      date: '2026-01-02',
      body: 'custom\n'
    })
    expect(m.body).toBe('custom\n')
  })

  it('numbers a second meeting of the same series on the same day', async () => {
    const input = { workspace: 'research', series: 'Supervision', date: '2026-09-24' } as const
    await store.create(input)
    const second = await store.create(input)
    const third = await store.create(input)
    expect(second.ref.id).toBe('2026-09-24 Supervision 2')
    expect(third.ref.id).toBe('2026-09-24 Supervision 3')
  })

  it('never overwrites a file that already exists, even one the index does not know', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('2026-09-24 Supervision'), 'hand-written, unindexed')
    const m = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24'
    })
    expect(m.ref.id).toBe('2026-09-24 Supervision 2')
    expect(disk('2026-09-24 Supervision')).toBe('hand-written, unindexed')
  })

  it('does not overwrite when two creates race for the same name', async () => {
    const input = { workspace: 'research', series: 'Other', date: '2026-09-24' } as const
    const results = await Promise.all([
      store.create(input),
      store.create(input),
      store.create(input)
    ])
    expect(new Set(results.map((r) => r.ref.id)).size).toBe(3)
    expect(readdirSync(dir).filter((f) => f.endsWith('.md'))).toHaveLength(3)
  })

  it('refuses invalid input without writing anything', async () => {
    const base = { workspace: 'research', series: 'Supervision', date: '2026-09-24' } as const
    await expect(store.create({ ...base, series: 'Book Club' })).rejects.toThrow(MeetingError)
    await expect(store.create({ ...base, date: '2026-13-01' })).rejects.toThrow('Invalid date')
    await expect(store.create({ ...base, start: '9:00' })).rejects.toThrow('Invalid start')
    await expect(store.create({ ...base, mode: 'hybrid' as never })).rejects.toThrow('Unknown mode')
    await expect(store.create({ ...base, workspace: 'life' as never })).rejects.toThrow(
      'Unknown workspace'
    )
    expect(() => readdirSync(dir)).toThrow()
  })
})

describe('read', () => {
  it('splits the file into meta and body', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file('x'),
      '---\nseries: Other\ndate: 2026-01-02\ncolour: blue\n---\n\n## Notes\r\ntext  \n'
    )
    const m = await store.read(ref('x'))
    expect(m.meta.series).toBe('Other')
    expect(m.body).toBe('## Notes\r\ntext  \n')
    expect(m.note.exists).toBe(true)
  })

  it('refuses a missing meeting and an unsafe id', async () => {
    await expect(store.read(ref('nope'))).rejects.toThrow('not found')
    await expect(store.read(ref('../secret'))).rejects.toThrow('Invalid meeting id')
  })
})

describe('save', () => {
  const original =
    '---\nseries: Supervision\ncolour: blue # keep\ndate: 2026-09-24\nattendees: [A B]\n---\n\n## Summary\r\n\r\n  odd \t\r\n## Notes\n- [ ] **TODO(EO)**: x\n'
  beforeEach(() => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('m'), original)
  })
  const hash = (): string => hashContent(original)

  it('saving a new body leaves the front matter exactly as it was', async () => {
    const result = await store.save(ref('m'), { body: 'new text\n' }, hash())
    expect(result.status).toBe('saved')
    expect(disk('m')).toBe(splitNote(original).head + 'new text\n')
  })

  it('saving metadata leaves the body byte-for-byte alone and keeps unknown keys', async () => {
    await store.save(ref('m'), { meta: { start: '10:00', mode: 'online' } }, hash())
    const after = disk('m')
    expect(splitNote(after).body).toBe(splitNote(original).body)
    expect(after).toContain('colour: blue # keep')
    expect(after).toContain("start: '10:00'")
  })

  it('returns the new hash and refreshes the index', async () => {
    const result = await store.save(ref('m'), { meta: { end: '11:00' } }, hash())
    expect(result).toEqual({ status: 'saved', hash: hashContent(disk('m')) })
    expect(getMeetingRow(db, 'research', 'm')?.end).toBe('11:00')
  })

  it('writes nothing and reports a conflict when the file changed underneath', async () => {
    writeFileSync(file('m'), original + 'added by Claude Code\n')
    const result = await store.save(ref('m'), { body: 'mine' }, hash())
    expect(result.status).toBe('conflict')
    if (result.status === 'conflict')
      expect(result.disk.content).toBe(original + 'added by Claude Code\n')
    expect(disk('m')).toBe(original + 'added by Claude Code\n')
  })

  it('does not write when nothing would change', async () => {
    const before = readdirSync(dir)
    expect((await store.save(ref('m'), {}, hash())).status).toBe('saved')
    expect(disk('m')).toBe(original)
    expect(readdirSync(dir)).toEqual(before)
  })

  it('never creates a file: saving a missing meeting is an error', async () => {
    await expect(store.save(ref('ghost'), { body: 'x' }, hashContent(''))).rejects.toThrow(
      'not found'
    )
    expect(readdirSync(dir)).toEqual(['m.md'])
  })

  it('refuses metadata it could not read back, leaving the file alone', async () => {
    await expect(store.save(ref('m'), { meta: { date: 'soon' } }, hash())).rejects.toThrow(
      'Invalid date'
    )
    await expect(store.save(ref('m'), { meta: { series: 'Nope' } }, hash())).rejects.toThrow(
      'Unknown series'
    )
    expect(disk('m')).toBe(original)
  })

  it('clearing the body leaves the file with its front matter, not deleted', async () => {
    await store.save(ref('m'), { body: '' }, hash())
    expect(disk('m')).toBe(splitNote(original).head)
  })
})

describe('reindex', () => {
  it('picks up a file another tool created, and drops the row when it is removed', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('2026-02-03 Other'), '---\nseries: Other\ndate: 2026-02-03\n---\n')
    expect(await store.reindexFile('research', '2026-02-03 Other.md')).toEqual(
      ref('2026-02-03 Other')
    )
    expect(getMeetingRow(db, 'research', '2026-02-03 Other')?.date).toBe('2026-02-03')
    rmSync(file('2026-02-03 Other'))
    await store.reindexFile('research', '2026-02-03 Other.md')
    expect(getMeetingRow(db, 'research', '2026-02-03 Other')).toBeNull()
  })

  it('ignores files that are not meetings', async () => {
    expect(await store.reindexFile('research', '.x.md.tmp')).toBeNull()
    expect(await store.reindexFile('research', 'notes.txt')).toBeNull()
  })

  it('reindexAll adds, refreshes and drops rows to match the folder', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('a'), '---\nseries: Other\ndate: 2026-01-01\n---\n')
    writeFileSync(file('b'), '---\nseries: Other\ndate: 2026-01-02\n---\n')
    await store.reindexAll('research')
    expect(listMeetingIds(db, 'research').sort()).toEqual(['a', 'b'])
    rmSync(file('b'))
    writeFileSync(file('a'), '---\nseries: Luminos\ndate: 2026-01-01\n---\n')
    await store.reindexAll('research')
    expect(listMeetingIds(db, 'research')).toEqual(['a'])
    expect(getMeetingRow(db, 'research', 'a')?.series).toBe('Luminos')
  })

  it('reindexAll copes with a missing folder', async () => {
    await expect(store.reindexAll('work')).resolves.toBeUndefined()
  })
})
