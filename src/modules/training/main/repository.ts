import type { Database } from 'better-sqlite3'
import type { TrainingIndexRow, TrainingMode, TrainingWorkspace } from '../shared/types'

interface Row {
  workspace: TrainingWorkspace
  entry_id: string
  date: string
  start_time: string | null
  end_time: string | null
  title: string
  series: string | null
  type: string | null
  mode: TrainingMode | null
  skills: string
  leads: string
  institution: string | null
  folder: string | null
  summary: string
  excerpt: string
  has_notes: number
  review: string | null
  problems: string
  content_hash: string
}

function toIndexRow(row: Row): TrainingIndexRow {
  return {
    workspace: row.workspace,
    id: row.entry_id,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
    title: row.title,
    series: row.series,
    type: row.type,
    mode: row.mode,
    skills: JSON.parse(row.skills) as string[],
    leads: JSON.parse(row.leads) as string[],
    institution: row.institution,
    folder: row.folder,
    summary: row.summary,
    excerpt: row.excerpt,
    hasNotes: row.has_notes === 1,
    review: row.review,
    problems: JSON.parse(row.problems) as string[],
    contentHash: row.content_hash
  }
}

/** Insert or replace the index row for one entry file. */
export function upsertTraining(db: Database, row: TrainingIndexRow): void {
  db.prepare(
    `INSERT INTO training (workspace, entry_id, date, start_time, end_time, title, series, type, mode,
                           skills, leads, institution, folder, summary, excerpt, has_notes, review,
                           problems, content_hash)
     VALUES (@workspace, @id, @date, @start, @end, @title, @series, @type, @mode,
             @skills, @leads, @institution, @folder, @summary, @excerpt, @hasNotes, @review,
             @problems, @contentHash)
     ON CONFLICT (workspace, entry_id) DO UPDATE SET
       date = excluded.date, start_time = excluded.start_time, end_time = excluded.end_time,
       title = excluded.title, series = excluded.series, type = excluded.type, mode = excluded.mode,
       skills = excluded.skills, leads = excluded.leads, institution = excluded.institution,
       folder = excluded.folder, summary = excluded.summary, excerpt = excluded.excerpt,
       has_notes = excluded.has_notes, review = excluded.review, problems = excluded.problems,
       content_hash = excluded.content_hash`
  ).run({
    ...row,
    skills: JSON.stringify(row.skills),
    leads: JSON.stringify(row.leads),
    hasNotes: row.hasNotes ? 1 : 0,
    problems: JSON.stringify(row.problems)
  })
}

export function deleteTrainingRow(db: Database, workspace: TrainingWorkspace, id: string): void {
  db.prepare('DELETE FROM training WHERE workspace = ? AND entry_id = ?').run(workspace, id)
}

export function getTrainingRow(
  db: Database,
  workspace: TrainingWorkspace,
  id: string
): TrainingIndexRow | null {
  const row = db
    .prepare('SELECT * FROM training WHERE workspace = ? AND entry_id = ?')
    .get(workspace, id) as Row | undefined
  return row ? toIndexRow(row) : null
}

/** Every indexed entry in a workspace, newest date first (ties by id). */
export function listTrainingRows(db: Database, workspace: TrainingWorkspace): TrainingIndexRow[] {
  return (
    db
      .prepare('SELECT * FROM training WHERE workspace = ? ORDER BY date DESC, entry_id DESC')
      .all(workspace) as Row[]
  ).map(toIndexRow)
}

export function listTrainingIds(db: Database, workspace: TrainingWorkspace): string[] {
  return (
    db.prepare('SELECT entry_id FROM training WHERE workspace = ?').all(workspace) as {
      entry_id: string
    }[]
  ).map((r) => r.entry_id)
}
