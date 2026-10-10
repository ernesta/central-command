import type { Database } from 'better-sqlite3'
import type {
  Author,
  ReferenceDetails,
  Reading,
  ReadingCounts,
  ReadingStatus,
  RenameSuggestion,
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

/** A non-empty DOI from a reading's stored `reference` JSON, or undefined. */
function doiOfRow(referenceJson: string | null): string | undefined {
  if (!referenceJson) return undefined
  try {
    return (JSON.parse(referenceJson) as ReferenceDetails).doi?.trim() || undefined
  } catch {
    return undefined
  }
}

/** A non-empty URL from a reading's stored `reference` JSON, or undefined. */
function urlOfRow(referenceJson: string | null): string | undefined {
  if (!referenceJson) return undefined
  try {
    return (JSON.parse(referenceJson) as ReferenceDetails).url?.trim() || undefined
  } catch {
    return undefined
  }
}

/**
 * A composite key for the low-confidence rename match (title + authors + year), or undefined if
 * either side of it is missing -- a weak match on a blank title or year would be worse than no
 * match at all. `authors` is compared as already-serialised JSON, which is how both a stored row
 * and an incoming entry's columns represent it, so an identical author list always produces an
 * identical string.
 */
function titleAuthorYearKeyOfRow(row: ReadingRow): string | undefined {
  const title = row.full_title.trim().toLowerCase()
  if (!title || row.year == null) return undefined
  return JSON.stringify([title, row.authors, row.year])
}

function titleAuthorYearKeyOfEntry(entry: SyncedFields): string | undefined {
  const title = entry.fullTitle.trim().toLowerCase()
  if (!title || entry.year == null) return undefined
  return JSON.stringify([title, JSON.stringify(entry.authors), entry.year])
}

interface RenameMatch {
  oldCitekey: string
  entry: SyncedFields
}

/**
 * Pair up vanished citekeys and newly-seen entries that share a value for `key`, one pair per
 * value. A value shared by more than one candidate on either side is ambiguous and matches
 * nothing for that value — left to the normal insert/flag/delete path rather than guessed at.
 */
function matchByKey(
  vanished: ReadonlyMap<string, ReadingRow>,
  appearing: ReadonlyMap<string, SyncedFields>,
  keyOfRow: (row: ReadingRow) => string | undefined,
  keyOfEntry: (entry: SyncedFields) => string | undefined
): RenameMatch[] {
  const vanishedByValue = new Map<string, string[]>()
  for (const [citekey, row] of vanished) {
    const value = keyOfRow(row)
    if (!value) continue
    const list = vanishedByValue.get(value)
    if (list) list.push(citekey)
    else vanishedByValue.set(value, [citekey])
  }
  const appearingByValue = new Map<string, SyncedFields[]>()
  for (const entry of appearing.values()) {
    const value = keyOfEntry(entry)
    if (!value) continue
    const list = appearingByValue.get(value)
    if (list) list.push(entry)
    else appearingByValue.set(value, [entry])
  }
  const matches: RenameMatch[] = []
  for (const [value, oldCitekeys] of vanishedByValue) {
    const entries = appearingByValue.get(value)
    if (!entries || oldCitekeys.length !== 1 || entries.length !== 1) continue
    matches.push({ oldCitekey: oldCitekeys[0], entry: entries[0] })
  }
  return matches
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
 * - A vanished citekey (in the database, absent from the export) and a newly-seen one (in the
 *   export, absent from the database) that share a non-empty DOI, or failing that a non-empty
 *   URL, are treated as the same work renamed: the existing row is updated in place to the new
 *   citekey and fields (counted as an update, never a flag or an insert), and
 *   `reading_list_mentions` is repointed to the new citekey in the same transaction. A DOI or URL
 *   shared by more than one candidate on either side is ambiguous and is left to the plain
 *   insert/flag/delete path below rather than guessed at. `onRenamed`, called once per match after
 *   the transaction commits, lets a caller move the reading's own notes file (kept on disk under
 *   its old citekey name) to follow — `reading_list_mentions` and the database row move inside the
 *   transaction because they are this module's own data; a note's or list's own file content (an
 *   `@` mention written as literal text) is not rewritten here.
 * - New citekey (and not matched to a vanished one): inserted.
 * - Known citekey: synced fields overwritten; `updated_at` moves only if a synced
 *   field actually changed; a "missing" flag is cleared. Notes caches are never touched.
 * - Known citekey absent from the export, found missing for the first time: deleted outright if
 *   nothing is attached to it (no notes, no `reading_list_mentions` row, no `@` mention in
 *   `mentionedCitekeys`); otherwise flagged `missing_from_source`. A citekey already flagged from an
 *   earlier sync is left as it is (no grace sync, and no retroactive deletion of old flagged rows).
 * - A vanished citekey that stays attached (flagged rather than deleted -- including one already
 *   flagged from an earlier sync, which is attached by the invariant above) and a newly-seen one
 *   that share no DOI/URL but do match on title + authors + year: recorded in `rename_suggestions`
 *   as a pending suggestion (`listPendingRenameSuggestions`), rather than merged. A bare vanished
 *   citekey (nothing attached, about to be deleted) is never matched this way -- there would be
 *   nothing left for a later Link to merge into. An ambiguous share (more than one candidate pair)
 *   produces no suggestion, same as stage 3's DOI/URL match. A pair already dismissed
 *   (`dismissRenameSuggestion`) is never recorded again, by the table's unique (old, new) pair.
 *
 * Running it twice with the same input changes nothing the second time.
 */
export function applySync(
  db: Database,
  incoming: readonly SyncedFields[],
  now: string,
  mentionedCitekeys: ReadonlySet<string> = new Set(),
  onRenamed?: (from: string, to: string) => void
): SyncCounts {
  const counts: SyncCounts = {
    entriesSeen: incoming.length,
    inserted: 0,
    updated: 0,
    flaggedMissing: 0,
    deleted: 0
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
  const deleteRow = db.prepare('DELETE FROM readings WHERE citekey = ?')
  const renameRow = db.prepare(
    `UPDATE readings SET
       citekey = @citekey, short_citation = @short_citation, full_title = @full_title,
       authors = @authors, year = @year, status = @status, tags = @tags, abstract = @abstract,
       entry_type = @entry_type, reference = @reference, missing_from_source = 0, updated_at = @now
     WHERE citekey = @oldCitekey`
  )

  const performedRenames: { from: string; to: string }[] = []

  db.transaction(() => {
    const incomingKeys = new Set(incoming.map((entry) => entry.citekey))
    const vanished = new Map([...existing].filter(([citekey]) => !incomingKeys.has(citekey)))
    const appearing = new Map(
      incoming
        .filter((entry) => !existing.has(entry.citekey))
        .map((entry) => [entry.citekey, entry])
    )

    const doiMatches = matchByKey(
      vanished,
      appearing,
      (row) => doiOfRow(row.reference),
      (entry) => entry.reference.doi?.trim() || undefined
    )
    for (const match of doiMatches) {
      vanished.delete(match.oldCitekey)
      appearing.delete(match.entry.citekey)
    }
    const urlMatches = matchByKey(
      vanished,
      appearing,
      (row) => urlOfRow(row.reference),
      (entry) => entry.reference.url?.trim() || undefined
    )
    for (const match of urlMatches) {
      vanished.delete(match.oldCitekey)
      appearing.delete(match.entry.citekey)
    }

    const renames = [...doiMatches, ...urlMatches]
    const matchedNewCitekeys = new Set(renames.map((match) => match.entry.citekey))

    if (renames.length > 0) {
      const renameMentions = db.prepare(
        'UPDATE reading_list_mentions SET citekey = @to WHERE citekey = @from'
      )
      for (const match of renames) {
        const columns = toColumns(match.entry)
        renameRow.run({ ...columns, now, oldCitekey: match.oldCitekey })
        renameMentions.run({ from: match.oldCitekey, to: match.entry.citekey })
        counts.updated++
        performedRenames.push({ from: match.oldCitekey, to: match.entry.citekey })
      }
    }

    // Whether each remaining vanished citekey will end up flagged rather than deleted below.
    // Already flagged from an earlier sync (missing_from_source = 1) implies attached: stage 2
    // never leaves a bare row flagged, so this never re-checks has_notes/mentions for one.
    // `reading_list_mentions` is only queried when there's at least one candidate, so a caller
    // without that table (a unit test exercising just the synced-fields path) never pays for it.
    const attached = new Map<string, boolean>()
    if (vanished.size > 0) {
      const hasListMention = db.prepare(
        'SELECT 1 FROM reading_list_mentions WHERE citekey = ? LIMIT 1'
      )
      for (const [citekey, row] of vanished) {
        attached.set(
          citekey,
          row.missing_from_source === 1 ||
            row.has_notes === 1 ||
            hasListMention.get(citekey) !== undefined ||
            mentionedCitekeys.has(citekey)
        )
      }
    }

    // Low-confidence rename suggestions: only among vanished citekeys that stay attached (and so
    // keep their row to Link into) -- a bare one is about to be deleted below regardless of any
    // match, so there would be nothing left to suggest linking to.
    const attachedVanished = new Map([...vanished].filter(([citekey]) => attached.get(citekey)))
    const suggestionMatches = matchByKey(
      attachedVanished,
      appearing,
      (row) => titleAuthorYearKeyOfRow(row),
      (entry) => titleAuthorYearKeyOfEntry(entry)
    )
    if (suggestionMatches.length > 0) {
      const insertSuggestion = db.prepare(
        `INSERT OR IGNORE INTO rename_suggestions (old_citekey, new_citekey, status, created_at)
         VALUES (@oldCitekey, @newCitekey, 'pending', @now)`
      )
      for (const match of suggestionMatches) {
        insertSuggestion.run({ oldCitekey: match.oldCitekey, newCitekey: match.entry.citekey, now })
      }
    }

    for (const entry of incoming) {
      if (matchedNewCitekeys.has(entry.citekey)) continue
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

    for (const [citekey, row] of vanished) {
      if (row.missing_from_source === 1) continue // already settled on an earlier sync
      if (attached.get(citekey)) {
        flag.run({ citekey })
        counts.flaggedMissing++
      } else {
        deleteRow.run(citekey)
        counts.deleted++
      }
    }
  })()

  for (const { from, to } of performedRenames) onRenamed?.(from, to)

  return counts
}

interface RenameSuggestionRow {
  id: number
  old_citekey: string
  new_citekey: string
  old_short_citation: string
  new_short_citation: string
}

/** Every pending (not yet linked or dismissed) suggested rename, for the "may now be" banner row. */
export function listPendingRenameSuggestions(db: Database): RenameSuggestion[] {
  const rows = db
    .prepare(
      `SELECT rs.id AS id, rs.old_citekey AS old_citekey, rs.new_citekey AS new_citekey,
              o.short_citation AS old_short_citation, n.short_citation AS new_short_citation
       FROM rename_suggestions rs
       JOIN readings o ON o.citekey = rs.old_citekey
       JOIN readings n ON n.citekey = rs.new_citekey
       WHERE rs.status = 'pending'
       ORDER BY rs.id`
    )
    .all() as RenameSuggestionRow[]
  return rows.map((row) => ({
    id: row.id,
    oldCitekey: row.old_citekey,
    newCitekey: row.new_citekey,
    oldShortCitation: row.old_short_citation,
    newShortCitation: row.new_short_citation
  }))
}

/**
 * Confirm a suggested rename: the same merge a DOI/URL match (stage 3) applies automatically,
 * done here by hand. The vanished row (old citekey) keeps its id, notes and
 * `reading_list_mentions`, takes the new citekey and the other row's current synced fields; the
 * duplicate row the sync inserted under the new citekey is removed, and the suggestion with it.
 * Returns the pair on success, or null if the suggestion (or either row it names) is no longer
 * there -- nothing to link.
 */
export function linkRenameSuggestion(
  db: Database,
  id: number,
  now: string
): { oldCitekey: string; newCitekey: string } | null {
  const suggestion = db
    .prepare('SELECT old_citekey, new_citekey FROM rename_suggestions WHERE id = ?')
    .get(id) as { old_citekey: string; new_citekey: string } | undefined
  if (!suggestion) return null
  const oldCitekey = suggestion.old_citekey
  const newCitekey = suggestion.new_citekey

  const oldRow = db.prepare('SELECT * FROM readings WHERE citekey = ?').get(oldCitekey) as
    ReadingRow | undefined
  const newRow = db.prepare('SELECT * FROM readings WHERE citekey = ?').get(newCitekey) as
    ReadingRow | undefined
  if (!oldRow || !newRow) return null

  const renameRow = db.prepare(
    `UPDATE readings SET
       citekey = @newCitekey, short_citation = @short_citation, full_title = @full_title,
       authors = @authors, year = @year, status = @status, tags = @tags, abstract = @abstract,
       entry_type = @entry_type, reference = @reference, missing_from_source = 0, updated_at = @now
     WHERE citekey = @oldCitekey`
  )

  db.transaction(() => {
    // The duplicate row goes first: citekey is UNIQUE, and the old row is about to take this
    // same citekey.
    db.prepare('DELETE FROM readings WHERE citekey = ?').run(newCitekey)
    renameRow.run({
      oldCitekey,
      newCitekey,
      short_citation: newRow.short_citation,
      full_title: newRow.full_title,
      authors: newRow.authors,
      year: newRow.year,
      status: newRow.status,
      tags: newRow.tags,
      abstract: newRow.abstract,
      entry_type: newRow.entry_type,
      reference: newRow.reference,
      now
    })
    db.prepare(
      'UPDATE reading_list_mentions SET citekey = @newCitekey WHERE citekey = @oldCitekey'
    ).run({ oldCitekey, newCitekey })
    db.prepare('DELETE FROM rename_suggestions WHERE id = ?').run(id)
  })()

  return { oldCitekey, newCitekey }
}

/**
 * Dismiss a suggestion without touching either reading. Permanent for this exact old/new pair
 * (the row is kept, not deleted, so its unique (old_citekey, new_citekey) blocks the same pair
 * ever being suggested again) -- the same old citekey may still legitimately pair with a
 * different new one on a later sync.
 */
export function dismissRenameSuggestion(db: Database, id: number): void {
  db.prepare("UPDATE rename_suggestions SET status = 'dismissed' WHERE id = ?").run(id)
}

export function recordSyncRun(
  db: Database,
  run: Omit<SyncRun, 'errorMessage'> & { errorMessage?: string | null }
): void {
  db.prepare(
    `INSERT INTO sync_runs
       (started_at, finished_at, status, entries_seen, inserted, updated, flagged_missing, deleted, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    run.startedAt,
    run.finishedAt,
    run.status,
    run.entriesSeen,
    run.inserted,
    run.updated,
    run.flaggedMissing,
    run.deleted,
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
  deleted: number
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
    deleted: row.deleted,
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
