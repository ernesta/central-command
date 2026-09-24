import type { Database } from 'better-sqlite3'
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
  content_hash: string
}

function toIndexRow(row: Row): MeetingIndexRow {
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
    contentHash: row.content_hash
  }
}

/** Insert or replace the index row for one meeting file. */
export function upsertMeeting(db: Database, row: MeetingIndexRow): void {
  db.prepare(
    `INSERT INTO meetings (workspace, meeting_id, series, date, start_time, end_time, mode,
                           attendees, summary, excerpt, problems, content_hash)
     VALUES (@workspace, @id, @series, @date, @start, @end, @mode,
             @attendees, @summary, @excerpt, @problems, @contentHash)
     ON CONFLICT (workspace, meeting_id) DO UPDATE SET
       series = excluded.series, date = excluded.date, start_time = excluded.start_time,
       end_time = excluded.end_time, mode = excluded.mode, attendees = excluded.attendees,
       summary = excluded.summary, excerpt = excluded.excerpt, problems = excluded.problems,
       content_hash = excluded.content_hash`
  ).run({
    ...row,
    attendees: JSON.stringify(row.attendees),
    problems: JSON.stringify(row.problems)
  })
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
    .get(workspace, id) as Row | undefined
  return row ? toIndexRow(row) : null
}

/** Every indexed meeting in a workspace, newest date first (ties by id). */
export function listMeetingRows(db: Database, workspace: MeetingWorkspace): MeetingIndexRow[] {
  return (
    db
      .prepare('SELECT * FROM meetings WHERE workspace = ? ORDER BY date DESC, meeting_id DESC')
      .all(workspace) as Row[]
  ).map(toIndexRow)
}

export function listMeetingIds(db: Database, workspace: MeetingWorkspace): string[] {
  return (
    db.prepare('SELECT meeting_id FROM meetings WHERE workspace = ?').all(workspace) as {
      meeting_id: string
    }[]
  ).map((r) => r.meeting_id)
}
