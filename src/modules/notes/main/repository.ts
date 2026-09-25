import type { Database } from 'better-sqlite3'
import type { NoteIndexRow, NoteWorkspace } from '../shared/types'

interface Row {
  workspace: NoteWorkspace
  note_id: string
  title: string
  group_name: string
  subgroup: string
  pinned: number
  created: string
  edited: number
  first_line: string
  excerpt: string
  problems: string
  content_hash: string
}

function toIndexRow(row: Row): NoteIndexRow {
  return {
    workspace: row.workspace,
    id: row.note_id,
    title: row.title,
    group: row.group_name,
    subgroup: row.subgroup,
    pinned: row.pinned === 1,
    created: row.created,
    edited: row.edited,
    firstLine: row.first_line,
    excerpt: row.excerpt,
    problems: JSON.parse(row.problems) as string[],
    contentHash: row.content_hash
  }
}

/** Insert or replace the index row for one note file. */
export function upsertNote(db: Database, row: NoteIndexRow): void {
  db.prepare(
    `INSERT INTO notes (workspace, note_id, title, group_name, subgroup, pinned, created, edited,
                        first_line, excerpt, problems, content_hash)
     VALUES (@workspace, @id, @title, @group, @subgroup, @pinned, @created, @edited,
             @firstLine, @excerpt, @problems, @contentHash)
     ON CONFLICT (workspace, note_id) DO UPDATE SET
       title = excluded.title, group_name = excluded.group_name, subgroup = excluded.subgroup,
       pinned = excluded.pinned, created = excluded.created, edited = excluded.edited,
       first_line = excluded.first_line, excerpt = excluded.excerpt, problems = excluded.problems,
       content_hash = excluded.content_hash`
  ).run({ ...row, pinned: row.pinned ? 1 : 0, problems: JSON.stringify(row.problems) })
}

/** Remove a note's index row. */
export function deleteNoteRow(db: Database, workspace: NoteWorkspace, id: string): void {
  db.prepare('DELETE FROM notes WHERE workspace = ? AND note_id = ?').run(workspace, id)
}

export function getNoteRow(
  db: Database,
  workspace: NoteWorkspace,
  id: string
): NoteIndexRow | null {
  const row = db
    .prepare('SELECT * FROM notes WHERE workspace = ? AND note_id = ?')
    .get(workspace, id) as Row | undefined
  return row ? toIndexRow(row) : null
}

/** Every indexed note in a workspace, most recently edited first (ties by id). */
export function listNoteRows(db: Database, workspace: NoteWorkspace): NoteIndexRow[] {
  return (
    db
      .prepare('SELECT * FROM notes WHERE workspace = ? ORDER BY edited DESC, note_id ASC')
      .all(workspace) as Row[]
  ).map(toIndexRow)
}

export function listNoteIds(db: Database, workspace: NoteWorkspace): string[] {
  return (
    db.prepare('SELECT note_id FROM notes WHERE workspace = ?').all(workspace) as {
      note_id: string
    }[]
  ).map((r) => r.note_id)
}
