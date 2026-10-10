import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { readingListsMigrations } from '../../reading-lists/main/migrations'
import type { SyncedFields } from '../shared/types'
import { readingsMigrations } from './migrations'
import {
  applySync,
  dismissRenameSuggestion,
  getCounts,
  getReadingByCitekey,
  lastSyncRun,
  linkRenameSuggestion,
  listAllReadings,
  listPendingRenameSuggestions,
  recordSyncRun
} from './repository'

const T1 = '2026-01-01T10:00:00.000Z'
const T2 = '2026-01-02T10:00:00.000Z'
const T3 = '2026-01-03T10:00:00.000Z'
const T4 = '2026-01-04T10:00:00.000Z'

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
  runMigrations(db, readingListsMigrations)
})

const get = (citekey: string): NonNullable<ReturnType<typeof getReadingByCitekey>> => {
  const r = getReadingByCitekey(db, citekey)
  if (!r) throw new Error(`no reading ${citekey}`)
  return r
}

/** Gives `citekey` a Reading Lists mention, the way `upsertList` would index one. */
function mentionInReadingList(citekey: string): void {
  db.prepare(
    `INSERT INTO reading_list_mentions (workspace, list_id, list_title, section, citekey, annotation)
     VALUES ('research', 'list-1', 'A list', 'Section', ?, '')`
  ).run(citekey)
}

/** Gives `citekey` notes, the way `NotesStore.updateCache` would cache a non-empty note. */
function attachNotes(citekey: string): void {
  db.prepare("UPDATE readings SET has_notes = 1, notes_excerpt = 'keep me' WHERE citekey = ?").run(
    citekey
  )
}

describe('applySync: inserting', () => {
  it('inserts new citekeys with added_at and updated_at set to now', () => {
    const counts = applySync(db, [entry('a', { status: 'to_read', tags: ['x'] }), entry('b')], T1)
    expect(counts).toEqual({
      entriesSeen: 2,
      inserted: 2,
      updated: 0,
      flaggedMissing: 0,
      deleted: 0
    })
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
    expect(counts).toEqual({
      entriesSeen: 2,
      inserted: 0,
      updated: 0,
      flaggedMissing: 0,
      deleted: 0
    })
    expect(db.prepare('SELECT * FROM readings ORDER BY id').all()).toEqual(before)
  })
})

describe('applySync: missing and attached (flagged, never deleted)', () => {
  it('flags a citekey with notes that leaves the export, and never deletes it', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    attachNotes('b')
    const counts = applySync(db, [entry('a')], T2)
    expect(counts).toMatchObject({ flaggedMissing: 1, deleted: 0 })
    expect(get('b')).toMatchObject({ missingFromSource: true, updatedAt: T1 })
    expect(get('a').missingFromSource).toBe(false)
    expect(getCounts(db).total).toBe(2)
  })

  it('keeps notes information on a missing reading', () => {
    applySync(db, [entry('a')], T1)
    attachNotes('a')
    applySync(db, [entry('other')], T2)
    expect(get('a')).toMatchObject({
      missingFromSource: true,
      hasNotes: true,
      notesExcerpt: 'keep me'
    })
  })

  it('flags a citekey with only a Reading Lists mention that leaves the export', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    mentionInReadingList('b')
    const counts = applySync(db, [entry('a')], T2)
    expect(counts).toMatchObject({ flaggedMissing: 1, deleted: 0 })
    expect(get('b').missingFromSource).toBe(true)
  })

  it('flags a citekey with only an @ mention that leaves the export', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    const counts = applySync(db, [entry('a')], T2, new Set(['b']))
    expect(counts).toMatchObject({ flaggedMissing: 1, deleted: 0 })
    expect(get('b').missingFromSource).toBe(true)
  })

  it('counts a newly missing (attached) reading once, not on every run', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    attachNotes('b')
    expect(applySync(db, [entry('a')], T2).flaggedMissing).toBe(1)
    expect(applySync(db, [entry('a')], T3).flaggedMissing).toBe(0)
  })

  it('clears the flag when the citekey comes back, without bumping updated_at if unchanged', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    attachNotes('b')
    applySync(db, [entry('a')], T2)
    const counts = applySync(db, [entry('a'), entry('b')], T3)
    expect(counts).toMatchObject({ inserted: 0, updated: 0 })
    expect(get('b')).toMatchObject({ missingFromSource: false, updatedAt: T1 })
  })

  it('clears the flag and updates fields when it comes back changed', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    attachNotes('b')
    applySync(db, [entry('a')], T2)
    applySync(db, [entry('a'), entry('b', { fullTitle: 'Renamed' })], T3)
    expect(get('b')).toMatchObject({
      missingFromSource: false,
      fullTitle: 'Renamed',
      updatedAt: T3
    })
  })

  it('keeps a reading (with notes) whose citekey changed in Zotero: the old one is flagged, the new inserted', () => {
    applySync(db, [entry('oldKey')], T1)
    attachNotes('oldKey')
    applySync(db, [entry('newKey')], T2)
    expect(get('oldKey').missingFromSource).toBe(true)
    expect(get('newKey').missingFromSource).toBe(false)
  })
})

describe('applySync: rename matching by DOI/URL (same work renamed in Zotero)', () => {
  const withDoi = (
    citekey: string,
    doi: string,
    overrides: Partial<SyncedFields> = {}
  ): SyncedFields =>
    entry(citekey, { reference: { titleSentence: `Title of ${citekey}`, doi }, ...overrides })
  const withUrl = (
    citekey: string,
    url: string,
    overrides: Partial<SyncedFields> = {}
  ): SyncedFields =>
    entry(citekey, { reference: { titleSentence: `Title of ${citekey}`, url }, ...overrides })

  it('updates in place on a shared DOI, keeping id and notes, and moving Reading Lists mentions', () => {
    applySync(db, [withDoi('oldKey', '10.1/x', { status: 'read', tags: ['keep'] })], T1)
    attachNotes('oldKey')
    mentionInReadingList('oldKey')
    const oldId = get('oldKey').id

    const renamed: { from: string; to: string }[] = []
    // The new export's own status/tags still win, exactly as a normal update would: the match
    // only decides which row is "the same work", not that its user fields freeze in place.
    const counts = applySync(
      db,
      [withDoi('newKey', '10.1/x', { status: 'to_read', tags: ['fresh'] })],
      T2,
      new Set(),
      (from, to) => renamed.push({ from, to })
    )

    expect(counts).toMatchObject({ inserted: 0, updated: 1, flaggedMissing: 0, deleted: 0 })
    expect(getReadingByCitekey(db, 'oldKey')).toBeNull()
    expect(get('newKey')).toMatchObject({
      id: oldId,
      status: 'to_read',
      tags: ['fresh'],
      hasNotes: true,
      notesExcerpt: 'keep me',
      missingFromSource: false,
      updatedAt: T2
    })
    expect(db.prepare('SELECT citekey FROM reading_list_mentions').all()).toEqual([
      { citekey: 'newKey' }
    ])
    expect(renamed).toEqual([{ from: 'oldKey', to: 'newKey' }])
  })

  it('updates in place on a shared URL when neither side has a DOI', () => {
    applySync(db, [withUrl('oldKey', 'https://example.com/paper')], T1)
    attachNotes('oldKey')
    const counts = applySync(db, [withUrl('newKey', 'https://example.com/paper')], T2)
    expect(counts).toMatchObject({ inserted: 0, updated: 1, flaggedMissing: 0, deleted: 0 })
    expect(getReadingByCitekey(db, 'oldKey')).toBeNull()
    expect(get('newKey')).toMatchObject({ hasNotes: true, notesExcerpt: 'keep me' })
  })

  it('prefers a DOI match over a URL match when both would apply', () => {
    // oldKey shares a DOI with "byDoi" and (coincidentally) a URL with "byUrl"; DOI wins, so "byUrl"
    // falls through and is inserted fresh rather than being matched.
    applySync(
      db,
      [entry('oldKey', { reference: { titleSentence: 'x', doi: '10.1/x', url: 'https://x/p' } })],
      T1
    )
    attachNotes('oldKey')
    const counts = applySync(
      db,
      [
        entry('byDoi', { reference: { titleSentence: 'x', doi: '10.1/x' } }),
        entry('byUrl', { reference: { titleSentence: 'y', url: 'https://x/p' } })
      ],
      T2
    )
    expect(counts).toMatchObject({ inserted: 1, updated: 1, deleted: 0, flaggedMissing: 0 })
    expect(getReadingByCitekey(db, 'oldKey')).toBeNull()
    expect(get('byDoi')).toMatchObject({ hasNotes: true, notesExcerpt: 'keep me' })
    expect(get('byUrl')).toMatchObject({ hasNotes: false })
  })

  it('matches two simultaneous vanish+appear pairs by their own distinct DOIs, not cross-matched', () => {
    applySync(db, [withDoi('oldA', '10.1/a'), withDoi('oldB', '10.1/b')], T1)
    attachNotes('oldA')
    attachNotes('oldB')
    const counts = applySync(db, [withDoi('newA', '10.1/a'), withDoi('newB', '10.1/b')], T2)
    expect(counts).toMatchObject({ inserted: 0, updated: 2, deleted: 0, flaggedMissing: 0 })
    expect(getReadingByCitekey(db, 'oldA')).toBeNull()
    expect(getReadingByCitekey(db, 'oldB')).toBeNull()
    expect(get('newA').notesExcerpt).toBe('keep me')
    expect(get('newB').notesExcerpt).toBe('keep me')
  })

  it('leaves an ambiguous DOI (shared by more than one candidate) to the flag/delete path', () => {
    applySync(db, [withDoi('oldA', '10.1/dup'), withDoi('oldB', '10.1/dup')], T1)
    attachNotes('oldA')
    attachNotes('oldB')
    const counts = applySync(db, [withDoi('newKey', '10.1/dup')], T2)
    // No match: oldA and oldB are both flagged (attached), newKey is inserted fresh.
    expect(counts).toMatchObject({ inserted: 1, updated: 0, flaggedMissing: 2, deleted: 0 })
    expect(get('oldA').missingFromSource).toBe(true)
    expect(get('oldB').missingFromSource).toBe(true)
    expect(get('newKey').hasNotes).toBe(false)
  })

  it('a vanished citekey with no DOI/URL match still goes through stage 2 logic unchanged', () => {
    applySync(db, [entry('oldKey'), entry('untouched')], T1)
    attachNotes('oldKey')
    const counts = applySync(db, [entry('newKey'), entry('untouched')], T2)
    expect(counts).toMatchObject({ inserted: 1, updated: 0, flaggedMissing: 1, deleted: 0 })
    expect(get('oldKey').missingFromSource).toBe(true)
    expect(get('newKey').hasNotes).toBe(false)
  })

  it('a bare vanished citekey (nothing attached) with no DOI/URL match is deleted as before', () => {
    applySync(db, [entry('oldKey')], T1)
    const counts = applySync(db, [entry('newKey')], T2)
    expect(counts).toMatchObject({ inserted: 1, updated: 0, flaggedMissing: 0, deleted: 1 })
    expect(getReadingByCitekey(db, 'oldKey')).toBeNull()
  })

  it('mutation check: without the DOI/URL match, the rename falls back to flag + insert', () => {
    // Simulates disabling the match: no reference carries a DOI/URL, so the normal path applies.
    applySync(db, [entry('oldKey')], T1)
    attachNotes('oldKey')
    const counts = applySync(db, [entry('newKey')], T2)
    expect(counts).not.toMatchObject({ updated: 1 })
    expect(counts).toMatchObject({ inserted: 1, flaggedMissing: 1 })
    expect(get('oldKey').missingFromSource).toBe(true)
    expect(getReadingByCitekey(db, 'newKey')).not.toBeNull()
  })
})

describe('applySync: suggested rename matching by title/authors/year (stage 4)', () => {
  const sameAuthors = [{ family: 'Smith', given: 'A' }]
  /** A title+authors+year entry with no DOI/URL on either side, distinct from the `entry()` default. */
  const taY = (citekey: string, overrides: Partial<SyncedFields> = {}): SyncedFields =>
    entry(citekey, {
      fullTitle: 'A Shared Title',
      authors: sameAuthors,
      year: 2020,
      reference: { titleSentence: 'A Shared Title' },
      ...overrides
    })

  it('records a suggestion for a title/author/year match with no DOI/URL on either side, rather than renaming automatically', () => {
    applySync(db, [taY('oldKey')], T1)
    attachNotes('oldKey')
    const counts = applySync(db, [taY('newKey')], T2)
    expect(counts).toMatchObject({ inserted: 1, updated: 0, flaggedMissing: 1, deleted: 0 })
    expect(get('oldKey').missingFromSource).toBe(true)
    expect(get('newKey')).toBeTruthy()
    expect(listPendingRenameSuggestions(db)).toEqual([
      expect.objectContaining({ oldCitekey: 'oldKey', newCitekey: 'newKey' })
    ])
  })

  it('Link applies the same merge a DOI/URL match would: id, notes and mentions survive', () => {
    applySync(db, [taY('oldKey', { status: 'read', tags: ['keep'] })], T1)
    attachNotes('oldKey')
    mentionInReadingList('oldKey')
    const oldId = get('oldKey').id

    applySync(db, [taY('newKey', { status: 'to_read', tags: ['fresh'] })], T2)
    const suggestion = listPendingRenameSuggestions(db)[0]

    const result = linkRenameSuggestion(db, suggestion.id, T3)
    expect(result).toEqual({ oldCitekey: 'oldKey', newCitekey: 'newKey' })
    expect(getReadingByCitekey(db, 'oldKey')).toBeNull()
    expect(get('newKey')).toMatchObject({
      id: oldId,
      status: 'to_read',
      tags: ['fresh'],
      hasNotes: true,
      notesExcerpt: 'keep me',
      missingFromSource: false,
      updatedAt: T3
    })
    expect(db.prepare('SELECT citekey FROM reading_list_mentions').all()).toEqual([
      { citekey: 'newKey' }
    ])
    expect(listPendingRenameSuggestions(db)).toEqual([])
  })

  it('linking an unknown suggestion id does nothing and returns null', () => {
    applySync(db, [taY('oldKey')], T1)
    attachNotes('oldKey')
    applySync(db, [taY('newKey')], T2)
    const before = db.prepare('SELECT * FROM readings ORDER BY id').all()
    expect(linkRenameSuggestion(db, 999, T3)).toBeNull()
    expect(db.prepare('SELECT * FROM readings ORDER BY id').all()).toEqual(before)
  })

  it('Dismiss clears the suggestion without touching either row', () => {
    applySync(db, [taY('oldKey')], T1)
    attachNotes('oldKey')
    applySync(db, [taY('newKey')], T2)
    const suggestion = listPendingRenameSuggestions(db)[0]

    dismissRenameSuggestion(db, suggestion.id)

    expect(listPendingRenameSuggestions(db)).toEqual([])
    expect(get('oldKey').missingFromSource).toBe(true)
    expect(get('oldKey').hasNotes).toBe(true)
    expect(get('newKey')).toBeTruthy()
  })

  it('does not resurface a dismissed pair even when the match is recomputed on a later sync', () => {
    applySync(db, [taY('oldKey')], T1)
    attachNotes('oldKey')
    applySync(db, [taY('newKey')], T2) // suggestion recorded, pending
    dismissRenameSuggestion(db, listPendingRenameSuggestions(db)[0].id)

    // newKey itself vanishes with nothing attached, so it's deleted (stage 2) -- then reappears,
    // which makes it "newly seen" again while oldKey is still sitting there, unresolved, matching.
    applySync(db, [], T3)
    expect(getReadingByCitekey(db, 'newKey')).toBeNull()
    applySync(db, [taY('newKey')], T4)

    expect(listPendingRenameSuggestions(db)).toEqual([])
  })

  it('a pair sharing a DOI (not just title/authors/year) is renamed automatically, never suggested', () => {
    applySync(db, [taY('oldKey', { reference: { titleSentence: 'x', doi: '10.1/x' } })], T1)
    attachNotes('oldKey')
    const counts = applySync(
      db,
      [taY('newKey', { reference: { titleSentence: 'x', doi: '10.1/x' } })],
      T2
    )
    expect(counts).toMatchObject({ inserted: 0, updated: 1 })
    expect(getReadingByCitekey(db, 'oldKey')).toBeNull()
    expect(listPendingRenameSuggestions(db)).toEqual([])
  })

  it('an ambiguous title/author/year share (more than one candidate) produces no suggestion', () => {
    applySync(db, [taY('oldA'), taY('oldB')], T1)
    attachNotes('oldA')
    attachNotes('oldB')
    const counts = applySync(db, [taY('newKey')], T2)
    expect(counts).toMatchObject({ inserted: 1, flaggedMissing: 2, deleted: 0 })
    expect(listPendingRenameSuggestions(db)).toEqual([])
  })

  it('does not even record a suggestion for a bare vanished citekey (nothing attached), even if title/author/year match', () => {
    applySync(db, [taY('oldKey')], T1)
    const counts = applySync(db, [taY('newKey')], T2)
    expect(counts).toMatchObject({ inserted: 1, deleted: 1 })
    expect(getReadingByCitekey(db, 'oldKey')).toBeNull()
    expect(listPendingRenameSuggestions(db)).toEqual([])
    // Not just hidden by the join against a deleted row: never written in the first place.
    expect(db.prepare('SELECT * FROM rename_suggestions').all()).toEqual([])
  })
})

describe('applySync: delete-if-unattached when missing', () => {
  it('deletes a bare citekey that leaves the export, instead of leaving it flagged', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    const counts = applySync(db, [entry('a')], T2)
    expect(counts).toMatchObject({ flaggedMissing: 0, deleted: 1 })
    expect(getReadingByCitekey(db, 'b')).toBeNull()
    expect(getCounts(db).total).toBe(1)
  })

  it('never deletes a citekey that has notes', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    attachNotes('b')
    const counts = applySync(db, [entry('a')], T2)
    expect(counts).toMatchObject({ deleted: 0, flaggedMissing: 1 })
    expect(getReadingByCitekey(db, 'b')).not.toBeNull()
  })

  it('keeps a citekey that has only a Reading Lists mention, rather than deleting it', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    mentionInReadingList('b')
    const counts = applySync(db, [entry('a')], T2)
    expect(counts).toMatchObject({ deleted: 0, flaggedMissing: 1 })
    expect(getReadingByCitekey(db, 'b')).not.toBeNull()
  })

  it('keeps a citekey that has only an @ mention, rather than deleting it', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    const counts = applySync(db, [entry('a')], T2, new Set(['b']))
    expect(counts).toMatchObject({ deleted: 0, flaggedMissing: 1 })
    expect(getReadingByCitekey(db, 'b')).not.toBeNull()
  })

  it('leaves a citekey already flagged on an earlier sync alone (no retroactive deletion)', () => {
    applySync(db, [entry('a'), entry('b')], T1)
    attachNotes('b')
    applySync(db, [entry('a')], T2)
    db.prepare("UPDATE readings SET has_notes = 0, notes_excerpt = '' WHERE citekey = 'b'").run()
    const counts = applySync(db, [entry('a')], T3)
    expect(counts).toMatchObject({ deleted: 0, flaggedMissing: 0 })
    expect(getReadingByCitekey(db, 'b')).not.toBeNull()
  })

  it("status and tags don't protect a bare citekey from deletion", () => {
    applySync(db, [entry('a'), entry('b', { status: 'read', tags: ['keep'] })], T1)
    const counts = applySync(db, [entry('a')], T2)
    expect(counts.deleted).toBe(1)
    expect(getReadingByCitekey(db, 'b')).toBeNull()
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
    attachNotes('b')
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
    attachNotes('d')
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
      flaggedMissing: 0,
      deleted: 0
    })
    recordSyncRun(db, {
      startedAt: T2,
      finishedAt: T2,
      status: 'error',
      entriesSeen: 0,
      inserted: 0,
      updated: 0,
      flaggedMissing: 0,
      deleted: 0,
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
