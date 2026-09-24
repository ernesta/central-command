import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { SyncedFields } from '../shared/types'
import { readingsMigrations } from './migrations'
import {
  applySync,
  getCounts,
  getReadingByCitekey,
  lastSyncRun,
  listAllReadings,
  recordSyncRun
} from './repository'

const T1 = '2026-01-01T10:00:00.000Z'
const T2 = '2026-01-02T10:00:00.000Z'
const T3 = '2026-01-03T10:00:00.000Z'

function entry(citekey: string, overrides: Partial<SyncedFields> = {}): SyncedFields {
  return {
    citekey,
    shortCitation: `${citekey} (2020)`,
    fullTitle: `Title of ${citekey}`,
    authors: [{ family: citekey, given: 'A' }],
    year: 2020,
    status: 'unset',
    tags: [],
    abstract: null,
    entryType: 'article',
    reference: { titleSentence: `Title of ${citekey}` },
    ...overrides
  }
}

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, readingsMigrations)
})

const get = (citekey: string): NonNullable<ReturnType<typeof getReadingByCitekey>> => {
  const r = getReadingByCitekey(db, citekey)
  if (!r) throw new Error(`no reading ${citekey}`)
  return r
}

describe('applySync: inserting', () => {
  it('inserts new citekeys with added_at and updated_at set to now', () => {
    const counts = applySync(db, [entry('a', { status: 'to_read', tags: ['x'] }), entry('b')], T1)
    expect(counts).toEqual({ entriesSeen: 2, inserted: 2, updated: 0, flaggedMissing: 0 })
    expect(get('a')).toMatchObject({
      citekey: 'a',
      status: 'to_read',
      tags: ['x'],
      authors: [{ family: 'a', given: 'A' }],
      addedAt: T1,
      updatedAt: T1,
      missingFromSource: false,
      hasNotes: false,
      notesExcerpt: ''
    })
  })

  it('round-trips institutional authors and a null year and abstract', () => {
    applySync(db, [entry('a', { authors: [{ literal: 'World Bank' }], year: null })], T1)
    expect(get('a')).toMatchObject({
      authors: [{ literal: 'World Bank' }],
      year: null,
      abstract: null
    })
  })
})

describe('applySync: updating', () => {
  it('overwrites synced fields and bumps updated_at, keeping added_at', () => {
    applySync(db, [entry('a', { status: 'to_read' })], T1)
    const counts = applySync(
      db,
      [entry('a', { status: 'read', fullTitle: 'New title', abstract: 'Abs', tags: ['t'] })],
      T2
    )
    expect(counts).toMatchObject({ inserted: 0, updated: 1 })
    expect(get('a')).toMatchObject({
      status: 'read',
      fullTitle: 'New title',
      abstract: 'Abs',
      tags: ['t'],
      addedAt: T1,
      updatedAt: T2
    })
  })

  it('does not bump updated_at when nothing changed', () => {
    applySync(db, [entry('a')], T1)
    const counts = applySync(db, [entry('a')], T2)
    expect(counts).toMatchObject({ inserted: 0, updated: 0, flaggedMissing: 0 })
    expect(get('a').updatedAt).toBe(T1)
  })

  it('detects a change in each synced field', () => {
    const base = entry('a')
    const changes: Partial<SyncedFields>[] = [
      { shortCitation: 'Other (2020)' },
      { fullTitle: 'Other' },
      { authors: [{ literal: 'Someone' }] },
      { year: 2021 },
      { status: 'read' },
      { tags: ['new'] },
      { abstract: 'new' },
      { entryType: 'book' }
    ]
    for (const change of changes) {
      const fresh = new Database(':memory:')
      runMigrations(fresh, readingsMigrations)
      applySync(fresh, [base], T1)
      expect(applySync(fresh, [{ ...base, ...change }], T2).updated).toBe(1)
    }
  })

  it('never touches the notes caches or the local fields', () => {
    applySync(db, [entry('a')], T1)
    db.prepare(
      "UPDATE readings SET has_notes = 1, notes_excerpt = 'my notes' WHERE citekey = 'a'"
    ).run()
    applySync(db, [entry('a', { fullTitle: 'Changed' })], T2)
    expect(get('a')).toMatchObject({ hasNotes: true, notesExcerpt: 'my notes' })
  })
})

describe('applySync: reference details', () => {
  const journal = {
    titleSentence: 'A title',
    container: 'Journal',
    volume: '3',
    pages: '1–9',
    doi: '10.1/x'
  }

  it('stores the reference on insert and returns it with the reading', () => {
    applySync(db, [entry('a', { reference: journal })], T1)
    expect(get('a').reference).toEqual(journal)
  })

  it('back-fills a missing reference without counting an update or moving updated_at', () => {
    applySync(db, [entry('a')], T1)
    db.prepare("UPDATE readings SET reference = NULL WHERE citekey = 'a'").run() // as before the column existed
    expect(get('a').reference).toBeNull()
    const counts = applySync(db, [entry('a', { reference: journal })], T2)
    expect(counts).toMatchObject({ inserted: 0, updated: 0 })
    expect(get('a')).toMatchObject({ reference: journal, updatedAt: T1 })
  })

  it('stores a changed reference (say a corrected volume) without counting an update', () => {
    applySync(db, [entry('a', { reference: journal })], T1)
    const counts = applySync(db, [entry('a', { reference: { ...journal, volume: '4' } })], T2)
    expect(counts.updated).toBe(0)
    expect(get('a')).toMatchObject({ reference: { volume: '4' }, updatedAt: T1 })
  })

  it('stores the new reference together with other changes, and that does count as an update', () => {
    applySync(db, [entry('a', { reference: journal })], T1)
    const counts = applySync(
      db,
      [entry('a', { fullTitle: 'Renamed', reference: { ...journal, volume: '9' } })],
      T2
    )
    expect(counts.updated).toBe(1)
    expect(get('a')).toMatchObject({
      fullTitle: 'Renamed',
      reference: { volume: '9' },
      updatedAt: T2
    })
  })

  it('is idempotent with references present', () => {
    applySync(db, [entry('a', { reference: journal })], T1)
    const before = db.prepare('SELECT * FROM readings').all()
    expect(applySync(db, [entry('a', { reference: journal })], T2)).toMatchObject({ updated: 0 })
    expect(db.prepare('SELECT * FROM readings').all()).toEqual(before)
  })
})

describe('applySync: idempotence', () => {
  it('produces no changes on a second run over the same input', () => {
    const input = [entry('a', { status: 'read' }), entry('b', { tags: ['x', 'y'] })]
    applySync(db, input, T1)
    const before = db.prepare('SELECT * FROM readings ORDER BY id').all()
    const counts = applySync(db, input, T2)
    expect(counts).toEqual({ entriesSeen: 2, inserted: 0, updated: 0, flaggedMissing: 0 })
    expect(db.prepare('SELECT * FROM readings ORDER BY id').all()).toEqual(before)
  })
})

describe('applySync: missing from source', () => {
  it('flags citekeys that leave the export and never deletes them', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    const counts = applySync(db, [entry('a')], T2)
    expect(counts.flaggedMissing).toBe(1)
    expect(get('b')).toMatchObject({ missingFromSource: true, updatedAt: T1 })
    expect(get('a').missingFromSource).toBe(false)
    expect(getCounts(db).total).toBe(2)
  })

  it('keeps notes information on a missing reading', () => {
    applySync(db, [entry('a')], T1)
    db.prepare(
      "UPDATE readings SET has_notes = 1, notes_excerpt = 'keep me' WHERE citekey = 'a'"
    ).run()
    applySync(db, [entry('other')], T2)
    expect(get('a')).toMatchObject({
      missingFromSource: true,
      hasNotes: true,
      notesExcerpt: 'keep me'
    })
  })

  it('counts a newly missing reading once, not on every run', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    expect(applySync(db, [entry('a')], T2).flaggedMissing).toBe(1)
    expect(applySync(db, [entry('a')], T3).flaggedMissing).toBe(0)
  })

  it('clears the flag when the citekey comes back, without bumping updated_at if unchanged', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    applySync(db, [entry('a')], T2)
    const counts = applySync(db, [entry('a'), entry('b')], T3)
    expect(counts).toMatchObject({ inserted: 0, updated: 0 })
    expect(get('b')).toMatchObject({ missingFromSource: false, updatedAt: T1 })
  })

  it('clears the flag and updates fields when it comes back changed', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    applySync(db, [entry('a')], T2)
    applySync(db, [entry('a'), entry('b', { fullTitle: 'Renamed' })], T3)
    expect(get('b')).toMatchObject({
      missingFromSource: false,
      fullTitle: 'Renamed',
      updatedAt: T3
    })
  })

  it('keeps a reading whose citekey changed in Zotero: the old one is flagged, the new inserted', () => {
    applySync(db, [entry('oldKey')], T1)
    applySync(db, [entry('newKey')], T2)
    expect(get('oldKey').missingFromSource).toBe(true)
    expect(get('newKey').missingFromSource).toBe(false)
  })
})

describe('applySync: atomicity', () => {
  it('applies nothing if any row fails', () => {
    applySync(db, [entry('a', { status: 'to_read' })], T1)
    const bad = entry('c', { status: 'bogus' as never })
    expect(() => applySync(db, [entry('a', { status: 'read' }), entry('b'), bad], T2)).toThrow()
    expect(getCounts(db).total).toBe(1)
    expect(get('a')).toMatchObject({ status: 'to_read', updatedAt: T1 })
  })
})

describe('listAllReadings', () => {
  it('returns every reading, including ones missing from the export', () => {
    applySync(db, [entry('a', { status: 'read' }), entry('b')], T1)
    applySync(db, [entry('a', { status: 'read' })], T2)
    const all = listAllReadings(db)
    expect(all.map((r) => r.citekey).sort()).toEqual(['a', 'b'])
    expect(all.find((r) => r.citekey === 'b')?.missingFromSource).toBe(true)
  })
  it('is empty for an empty table', () => {
    expect(listAllReadings(db)).toEqual([])
  })
})

describe('getCounts', () => {
  it('is all zeros for an empty table', () => {
    expect(getCounts(db)).toEqual({ total: 0, read: 0, toRead: 0, unset: 0, missingFromSource: 0 })
  })

  it('counts by status and missing', () => {
    applySync(
      db,
      [
        entry('a', { status: 'read' }),
        entry('b', { status: 'to_read' }),
        entry('c', { status: 'to_read' }),
        entry('d')
      ],
      T1
    )
    applySync(
      db,
      [
        entry('a', { status: 'read' }),
        entry('b', { status: 'to_read' }),
        entry('c', { status: 'to_read' })
      ],
      T2
    )
    expect(getCounts(db)).toEqual({ total: 4, read: 1, toRead: 2, unset: 1, missingFromSource: 1 })
  })
})

describe('sync runs', () => {
  it('records runs and returns the latest, optionally by status', () => {
    expect(lastSyncRun(db)).toBeNull()
    recordSyncRun(db, {
      startedAt: T1,
      finishedAt: T1,
      status: 'ok',
      entriesSeen: 3,
      inserted: 3,
      updated: 0,
      flaggedMissing: 0
    })
    recordSyncRun(db, {
      startedAt: T2,
      finishedAt: T2,
      status: 'error',
      entriesSeen: 0,
      inserted: 0,
      updated: 0,
      flaggedMissing: 0,
      errorMessage: 'boom'
    })
    expect(lastSyncRun(db)).toMatchObject({ status: 'error', errorMessage: 'boom', startedAt: T2 })
    expect(lastSyncRun(db, 'ok')).toMatchObject({
      status: 'ok',
      entriesSeen: 3,
      errorMessage: null
    })
  })
})
