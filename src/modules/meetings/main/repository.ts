import type { Database } from 'better-sqlite3'
import type { TodoItem } from '../shared/todos'
import type { MeetingIndexRow, MeetingMode, MeetingWorkspace } from '../shared/types'

interface Row {
  workspace: MeetingWorkspace
  meeting_id: string
  series: string
  date: string
  start_time: string | null
  end_time: string | null
  mode: MeetingMode | null
  attendees: string
  summary: string
  excerpt: string
  problems: string
  topic_count: number
  content_hash: string
}

interface TodoRow {
  kind: TodoItem['kind']
  owners: string
  text: string
  done: number
}

function toIndexRow(row: Row, todos: TodoItem[]): MeetingIndexRow {
  return {
    workspace: row.workspace,
    id: row.meeting_id,
    series: row.series,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
    mode: row.mode,
    attendees: JSON.parse(row.attendees) as string[],
    summary: row.summary,
    excerpt: row.excerpt,
    problems: JSON.parse(row.problems) as string[],
    topicCount: row.topic_count,
    todos,
    contentHash: row.content_hash
  }
}

/** Insert or replace the index row for one meeting file, and replace its TODO rows with the current ones. */
export function upsertMeeting(db: Database, row: MeetingIndexRow): void {
  db.transaction(() => upsertMeetingRow(db, row))()
}

function upsertMeetingRow(db: Database, row: MeetingIndexRow): void {
  db.prepare(
    `INSERT INTO meetings (workspace, meeting_id, series, date, start_time, end_time, mode,
                           attendees, summary, excerpt, problems, topic_count, content_hash)
     VALUES (@workspace, @id, @series, @date, @start, @end, @mode,
             @attendees, @summary, @excerpt, @problems, @topicCount, @contentHash)
     ON CONFLICT (workspace, meeting_id) DO UPDATE SET
       series = excluded.series, date = excluded.date, start_time = excluded.start_time,
       end_time = excluded.end_time, mode = excluded.mode, attendees = excluded.attendees,
       summary = excluded.summary, excerpt = excluded.excerpt, problems = excluded.problems, topic_count = excluded.topic_count,
       content_hash = excluded.content_hash`
  ).run({
    ...row,
    attendees: JSON.stringify(row.attendees),
    problems: JSON.stringify(row.problems)
  })
  const pk = (
    db
      .prepare('SELECT id FROM meetings WHERE workspace = ? AND meeting_id = ?')
      .get(row.workspace, row.id) as { id: number }
  ).id
  db.prepare('DELETE FROM meeting_todos WHERE meeting_pk = ?').run(pk)
  const insert = db.prepare(
    `INSERT INTO meeting_todos (meeting_pk, position, kind, owners, text, done)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  row.todos.forEach((t, position) =>
    insert.run(pk, position, t.kind, JSON.stringify(t.owners), t.text, t.done ? 1 : 0)
  )
}

/** The TODOs recorded for one meeting, in note order. `line` is not stored (it is only meaningful for the body it came from). */
function todosOf(db: Database, pk: number): TodoItem[] {
  return (
    db
      .prepare(
        'SELECT kind, owners, text, done FROM meeting_todos WHERE meeting_pk = ? ORDER BY position'
      )
      .all(pk) as TodoRow[]
  ).map((t, position) => ({
    kind: t.kind,
    owners: JSON.parse(t.owners) as string[],
    text: t.text,
    done: t.done === 1,
    line: position
  }))
}

/** Remove a meeting's index row (its TODO rows go with it). */
export function deleteMeetingRow(db: Database, workspace: MeetingWorkspace, id: string): void {
  db.prepare('DELETE FROM meetings WHERE workspace = ? AND meeting_id = ?').run(workspace, id)
}

export function getMeetingRow(
  db: Database,
  workspace: MeetingWorkspace,
  id: string
): MeetingIndexRow | null {
  const row = db
    .prepare('SELECT * FROM meetings WHERE workspace = ? AND meeting_id = ?')
    .get(workspace, id) as (Row & { id: number }) | undefined
  return row ? toIndexRow(row, todosOf(db, row.id)) : null
}

/** Every indexed meeting in a workspace, newest date first (ties by id). */
export function listMeetingRows(db: Database, workspace: MeetingWorkspace): MeetingIndexRow[] {
  return (
    db
      .prepare('SELECT * FROM meetings WHERE workspace = ? ORDER BY date DESC, meeting_id DESC')
      .all(workspace) as (Row & { id: number })[]
  ).map((row) => toIndexRow(row, todosOf(db, row.id)))
}

export function listMeetingIds(db: Database, workspace: MeetingWorkspace): string[] {
  return (
    db.prepare('SELECT meeting_id FROM meetings WHERE workspace = ?').all(workspace) as {
      meeting_id: string
    }[]
  ).map((r) => r.meeting_id)
}
