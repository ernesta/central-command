import type { Database } from 'better-sqlite3'
import type { ReadingListMention } from '../shared/api'
import type { ReadingListIndexRow, ReadingListWorkspace } from '../shared/types'
import type { MentionRow } from './index-row'

interface Row {
  workspace: ReadingListWorkspace
  list_id: string
  title: string
  edited: number
  section_count: number
  entry_count: number
  excerpt: string
  content_hash: string
}

function toIndexRow(row: Row): ReadingListIndexRow {
  return {
    workspace: row.workspace,
    id: row.list_id,
    title: row.title,
    edited: row.edited,
    sectionCount: row.section_count,
    entryCount: row.entry_count,
    excerpt: row.excerpt,
    contentHash: row.content_hash
  }
}

/** Insert or replace the index row for one list file, and every reading it mentions. */
export function upsertList(
  db: Database,
  row: ReadingListIndexRow,
  mentions: readonly MentionRow[]
): void {
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO reading_lists (workspace, list_id, title, edited, section_count, entry_count, excerpt, content_hash)
       VALUES (@workspace, @id, @title, @edited, @sectionCount, @entryCount, @excerpt, @contentHash)
       ON CONFLICT (workspace, list_id) DO UPDATE SET
         title = excluded.title, edited = excluded.edited, section_count = excluded.section_count,
         entry_count = excluded.entry_count, excerpt = excluded.excerpt, content_hash = excluded.content_hash`
    ).run(row)
    db.prepare('DELETE FROM reading_list_mentions WHERE workspace = ? AND list_id = ?').run(
      row.workspace,
      row.id
    )
    const insertMention = db.prepare(
      `INSERT INTO reading_list_mentions (workspace, list_id, list_title, section, citekey, annotation)
       VALUES (@workspace, @listId, @listTitle, @section, @citekey, @annotation)`
    )
    for (const m of mentions) insertMention.run(m)
  })
  run()
}

/** Remove a list's index row and its mentions. */
export function deleteListRow(db: Database, workspace: ReadingListWorkspace, id: string): void {
  db.prepare('DELETE FROM reading_lists WHERE workspace = ? AND list_id = ?').run(workspace, id)
  db.prepare('DELETE FROM reading_list_mentions WHERE workspace = ? AND list_id = ?').run(
    workspace,
    id
  )
}

/** Every indexed list in a workspace, most recently edited first (ties by id). */
export function listListRows(db: Database, workspace: ReadingListWorkspace): ReadingListIndexRow[] {
  return (
    db
      .prepare('SELECT * FROM reading_lists WHERE workspace = ? ORDER BY edited DESC, list_id ASC')
      .all(workspace) as Row[]
  ).map(toIndexRow)
}

export function listListIds(db: Database, workspace: ReadingListWorkspace): string[] {
  return (
    db.prepare('SELECT list_id FROM reading_lists WHERE workspace = ?').all(workspace) as {
      list_id: string
    }[]
  ).map((r) => r.list_id)
}

interface MentionQueryRow {
  workspace: ReadingListWorkspace
  list_id: string
  list_title: string
  section: string
  annotation: string
}

/** Every list that names `citekey`, for that reading's own page. */
export function mentionsOf(db: Database, citekey: string): ReadingListMention[] {
  return (
    db
      .prepare(
        `SELECT workspace, list_id, list_title, section, annotation FROM reading_list_mentions
         WHERE citekey = ? ORDER BY list_title ASC, section ASC`
      )
      .all(citekey) as MentionQueryRow[]
  ).map((r) => ({
    ref: { workspace: r.workspace, id: r.list_id },
    listTitle: r.list_title,
    section: r.section,
    annotation: r.annotation
  }))
}
