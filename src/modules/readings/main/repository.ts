import type { Database } from 'better-sqlite3'
import type {
  Author,
  ReferenceDetails,
  Reading,
  ReadingCounts,
  ReadingStatus,
  SyncCounts,
  SyncedFields,
  SyncRun
} from '../shared/types'

interface ReadingRow {
  id: number
  citekey: string
  short_citation: string
  full_title: string
  authors: string
  year: number | null
  status: ReadingStatus
  tags: string
  abstract: string | null
  entry_type: string
  reference: string | null
  missing_from_source: number
  has_notes: number
  notes_excerpt: string
  added_at: string
  updated_at: string
}

export function rowToReading(row: ReadingRow): Reading {
  return {
    id: row.id,
    citekey: row.citekey,
    shortCitation: row.short_citation,
    fullTitle: row.full_title,
    authors: JSON.parse(row.authors) as Author[],
    year: row.year,
    status: row.status,
    tags: JSON.parse(row.tags) as string[],
    abstract: row.abstract,
    entryType: row.entry_type,
    reference: row.reference ? (JSON.parse(row.reference) as ReferenceDetails) : null,
    missingFromSource: row.missing_from_source === 1,
    hasNotes: row.has_notes === 1,
    notesExcerpt: row.notes_excerpt,
    addedAt: row.added_at,
    updatedAt: row.updated_at
  }
}

/**
 * Columns Zotero owns that a person would notice changing, in a stable serialised form for change
 * detection. `reference` (journal, volume, DOI...) is deliberately not part of it: it is stored
 * whenever it differs, but it does not count as an update or move `updated_at`, so back-filling it
 * for an existing library does not disturb "Recently updated".
 */
function syncedSignature(r: {
  short_citation: string
  full_title: string
  authors: string
  year: number | null
  status: string
  tags: string
  abstract: string | null
  entry_type: string
}): string {
  return JSON.stringify([
    r.short_citation,
    r.full_title,
    r.authors,
    r.year,
    r.status,
    r.tags,
    r.abstract,
    r.entry_type
  ])
}

function toColumns(
  entry: SyncedFields
): Omit<
  ReadingRow,
  'id' | 'missing_from_source' | 'has_notes' | 'notes_excerpt' | 'added_at' | 'updated_at'
> {
  return {
    citekey: entry.citekey,
    short_citation: entry.shortCitation,
    full_title: entry.fullTitle,
    authors: JSON.stringify(entry.authors),
    year: entry.year,
    status: entry.status,
    tags: JSON.stringify(entry.tags),
    abstract: entry.abstract,
    entry_type: entry.entryType,
    reference: JSON.stringify(entry.reference)
  }
}

/**
 * Apply a parsed export to the database in ONE transaction.
 *
 * - New citekey: inserted.
 * - Known citekey: synced fields overwritten; `updated_at` moves only if a synced
 *   field actually changed; a "missing" flag is cleared. Notes caches are never touched.
 * - Known citekey absent from the export: flagged `missing_from_source`. Rows are never deleted.
 *
 * Running it twice with the same input changes nothing the second time.
 */
export function applySync(
  db: Database,
  incoming: readonly SyncedFields[],
  now: string
): SyncCounts {
  const counts: SyncCounts = {
    entriesSeen: incoming.length,
    inserted: 0,
    updated: 0,
    flaggedMissing: 0
  }

  const existing = new Map(
    (db.prepare('SELECT * FROM readings').all() as ReadingRow[]).map((row) => [row.citekey, row])
  )
  const insert = db.prepare(
    `INSERT INTO readings
       (citekey, short_citation, full_title, authors, year, status, tags, abstract, entry_type, reference, added_at, updated_at)
     VALUES
       (@citekey, @short_citation, @full_title, @authors, @year, @status, @tags, @abstract, @entry_type, @reference, @now, @now)`
  )
  const update = db.prepare(
    `UPDATE readings SET
       short_citation = @short_citation, full_title = @full_title, authors = @authors, year = @year,
       status = @status, tags = @tags, abstract = @abstract, entry_type = @entry_type,
       reference = @reference, missing_from_source = 0, updated_at = @now
     WHERE citekey = @citekey`
  )
  const storeReference = db.prepare(
    'UPDATE readings SET reference = @reference WHERE citekey = @citekey'
  )
  const unflag = db.prepare('UPDATE readings SET missing_from_source = 0 WHERE citekey = @citekey')
  const flag = db.prepare('UPDATE readings SET missing_from_source = 1 WHERE citekey = @citekey')

  db.transaction(() => {
    const present = new Set<string>()
    for (const entry of incoming) {
      present.add(entry.citekey)
      const columns = toColumns(entry)
      const current = existing.get(entry.citekey)
      if (!current) {
        insert.run({ ...columns, now })
        counts.inserted++
      } else if (syncedSignature(current) !== syncedSignature(columns)) {
        update.run({ ...columns, now })
        counts.updated++
      } else {
        if (current.reference !== columns.reference) {
          storeReference.run({ citekey: entry.citekey, reference: columns.reference })
        }
        if (current.missing_from_source === 1) unflag.run({ citekey: entry.citekey })
      }
    }
    for (const [citekey, row] of existing) {
      if (!present.has(citekey) && row.missing_from_source === 0) {
        flag.run({ citekey })
        counts.flaggedMissing++
      }
    }
  })()

  return counts
}

export function recordSyncRun(
  db: Database,
  run: Omit<SyncRun, 'errorMessage'> & { errorMessage?: string | null }
): void {
  db.prepare(
    `INSERT INTO sync_runs
       (started_at, finished_at, status, entries_seen, inserted, updated, flagged_missing, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    run.startedAt,
    run.finishedAt,
    run.status,
    run.entriesSeen,
    run.inserted,
    run.updated,
    run.flaggedMissing,
    run.errorMessage ?? null
  )
}

interface SyncRunRow {
  started_at: string
  finished_at: string
  status: 'ok' | 'error'
  entries_seen: number
  inserted: number
  updated: number
  flagged_missing: number
  error_message: string | null
}

function rowToRun(row: SyncRunRow): SyncRun {
  return {
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    entriesSeen: row.entries_seen,
    inserted: row.inserted,
    updated: row.updated,
    flaggedMissing: row.flagged_missing,
    errorMessage: row.error_message
  }
}

export function lastSyncRun(db: Database, status?: 'ok' | 'error'): SyncRun | null {
  const row = (
    status
      ? db.prepare('SELECT * FROM sync_runs WHERE status = ? ORDER BY id DESC LIMIT 1').get(status)
      : db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1').get()
  ) as SyncRunRow | undefined
  return row ? rowToRun(row) : null
}

export function getCounts(db: Database): ReadingCounts {
  const row = db
    .prepare(
      `SELECT
         COUNT(*)                                        AS total,
         COALESCE(SUM(status = 'read'), 0)               AS read,
         COALESCE(SUM(status = 'to_read'), 0)            AS toRead,
         COALESCE(SUM(status = 'unset'), 0)              AS unset,
         COALESCE(SUM(missing_from_source = 1), 0)       AS missingFromSource
       FROM readings`
    )
    .get() as ReadingCounts
  return row
}

export function listAllReadings(db: Database): Reading[] {
  return (db.prepare('SELECT * FROM readings').all() as ReadingRow[]).map(rowToReading)
}

export function getReadingByCitekey(db: Database, citekey: string): Reading | null {
  const row = db.prepare('SELECT * FROM readings WHERE citekey = ?').get(citekey) as
    ReadingRow | undefined
  return row ? rowToReading(row) : null
}
