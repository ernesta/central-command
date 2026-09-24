import Database from 'better-sqlite3'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
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
let trashDir: string
let trashed: string[]
let trashFails = false
const file = (id: string): string => join(dir, `${id}.md`)
const disk = (id: string): string => readFileSync(file(id), 'utf8')
const ref = (id: string): MeetingRef => ({ workspace: 'research', id })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-meetings-'))
  dir = join(root, 'research')
  db = new Database(':memory:')
  runMigrations(db, meetingsMigrations)
  trashDir = join(root, '.Trash')
  trashed = []
  trashFails = false
  // A stand-in for the macOS Trash: moves the file into a folder, or fails.
  store = new MeetingsStore({
    db,
    dirFor: (w) => join(root, w),
    trash: async (path) => {
      if (trashFails) throw new Error('Trash unavailable')
      mkdirSync(trashDir, { recursive: true })
      renameSync(path, join(trashDir, basename(path)))
      trashed.push(path)
    }
  })
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

  it('keeps the index’s TODOs in step with what was saved', async () => {
    await store.save(ref('m'), { body: '## Notes\n- **TODO(EO)**: first\n' }, hash())
    expect(getMeetingRow(db, 'research', 'm')?.todos.map((t) => t.text)).toEqual(['first'])
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

describe('delete', () => {
  const content = '---\nseries: Other\ndate: 2026-02-03\n---\n\nprecious notes\n'
  beforeEach(() => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('a'), content)
    writeFileSync(file('b'), content)
  })

  it('moves the file to the Trash (recoverable) and drops its row', async () => {
    await store.reindexAll('research')
    await store.delete(ref('a'))
    expect(existsSync(file('a'))).toBe(false)
    expect(readFileSync(join(trashDir, 'a.md'), 'utf8')).toBe(content)
    expect(trashed).toEqual([file('a')])
    expect(getMeetingRow(db, 'research', 'a')).toBeNull()
  })

  it('touches only the meeting it was asked to delete', async () => {
    await store.reindexAll('research')
    await store.delete(ref('a'))
    expect(readFileSync(file('b'), 'utf8')).toBe(content)
    expect(getMeetingRow(db, 'research', 'b')).not.toBeNull()
  })

  it('leaves the file and its row alone when the Trash move fails', async () => {
    await store.reindexAll('research')
    trashFails = true
    await expect(store.delete(ref('a'))).rejects.toThrow('Trash unavailable')
    expect(readFileSync(file('a'), 'utf8')).toBe(content)
    expect(getMeetingRow(db, 'research', 'a')).not.toBeNull()
  })

  it('reports a missing meeting, and clears a stale row for it', async () => {
    await store.reindexAll('research')
    rmSync(file('a'))
    await expect(store.delete(ref('a'))).rejects.toThrow('not found')
    expect(trashed).toEqual([])
    expect(getMeetingRow(db, 'research', 'a')).toBeNull()
  })

  it('refuses ids that could point outside the meetings folder, calling nothing', async () => {
    await expect(store.delete(ref('../a'))).rejects.toThrow('Invalid meeting id')
    await expect(store.delete({ workspace: 'life' as never, id: 'a' })).rejects.toThrow(
      'Unknown workspace'
    )
    expect(trashed).toEqual([])
  })
})

describe('Previous TODOs carry-over', () => {
  const SUP = { workspace: 'research', series: 'Supervision' } as const
  const previousBody =
    '## Summary\n\n## Previous TODOs\n\n- [x] **TODO(EO)**: done\n- [ ] **TODO(KR)**: waiting\n\n## Notes\n\n- **TODO(EO)**: inline\n'

  it('fills a new meeting from the previous meeting of the same series', async () => {
    await store.create({ ...SUP, date: '2026-09-17', body: previousBody })
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(m.body).toBe(
      '## Summary\n\n## Previous TODOs\n\n- [ ] **TODO(KR)**: waiting\n- [ ] **TODO(EO)**: inline\n\n## Notes\n'
    )
  })

  it('does not carry from another series, or from a later meeting', async () => {
    await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-09-17',
      body: previousBody
    })
    await store.create({ ...SUP, date: '2026-10-01', body: previousBody })
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(m.body).toBe('## Summary\n\n## Previous TODOs\n\n## Notes\n')
  })

  it('a body given to create is used as it is, with no carry-over', async () => {
    await store.create({ ...SUP, date: '2026-09-17', body: previousBody })
    const m = await store.create({ ...SUP, date: '2026-09-24', body: 'mine\n' })
    expect(m.body).toBe('mine\n')
  })

  it('syncPreviousTodos adds what is missing when the meeting is opened, and only that', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    await store.create({ ...SUP, date: '2026-09-17', body: previousBody })
    // Move the new meeting on: tick nothing, type a note, then open it after the previous one changed.
    const r = m.ref
    const first = await store.syncPreviousTodos(r, m.note.hash)
    expect(first).toMatchObject({ status: 'saved', added: 2 })
    const after = await store.read(r)
    expect(after.body).toContain('- [ ] **TODO(KR)**: waiting')
    // Tick one, add a note; a second sync adds nothing and leaves everything as it is.
    const ticked =
      after.body.replace('- [ ] **TODO(KR)**: waiting', '- [x] **TODO(KR)**: waiting') + 'my note\n'
    await store.save(r, { body: ticked }, after.note.hash)
    const again = await store.read(r)
    expect(await store.syncPreviousTodos(r, again.note.hash)).toMatchObject({
      status: 'saved',
      added: 0
    })
    expect((await store.read(r)).body).toBe(ticked)
  })

  it('syncPreviousTodos refuses (writes nothing) when the file changed since the caller read it', async () => {
    await store.create({ ...SUP, date: '2026-09-17', body: previousBody })
    const m = await store.create({ ...SUP, date: '2026-09-24', body: '## Summary\n\n## Notes\n' })
    writeFileSync(file(m.ref.id), disk(m.ref.id) + 'edited elsewhere\n')
    const before = disk(m.ref.id)
    expect((await store.syncPreviousTodos(m.ref, m.note.hash)).status).toBe('conflict')
    expect(disk(m.ref.id)).toBe(before)
  })

  it('syncPreviousTodos does nothing for the first meeting of a series', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(await store.syncPreviousTodos(m.ref, m.note.hash)).toMatchObject({
      status: 'saved',
      added: 0
    })
  })
})
