import type { Database } from 'better-sqlite3'
import { DEFAULT_KEYWORDS } from '../shared/relevance'
import {
  WATCH_KINDS,
  WATCH_METHODS,
  WATCH_STATES,
  WATCH_WORKSPACES,
  kindsOf,
  shownKind,
  type DateKind,
  type NewWatchSource,
  type WatchCounts,
  type WatchItem,
  type WatchItemsQuery,
  type WatchKind,
  type WatchMethod,
  type WatchSource,
  type WatchSourceChanges,
  type WatchState,
  type WatchWorkspace
} from '../shared/types'

interface SourceRow {
  id: number
  workspace: WatchWorkspace
  title: string
  url: string
  kind: WatchKind
  method: WatchMethod
  issn: string | null
  group_label: string
  task_uid: string | null
  interval_hours: number
  active: number
  last_checked_at: string | null
  last_ok_at: string | null
  last_error: string | null
  failures: number
  changed_at: string | null
  created_at: string
  new_count: number
}

const SOURCE_SELECT = `
  SELECT s.*, (SELECT COUNT(*) FROM watch_items i WHERE i.source_id = s.id AND i.state = 'new') AS new_count
  FROM watch_sources s`

const toSource = (r: SourceRow): WatchSource => ({
  id: r.id,
  workspace: r.workspace,
  title: r.title,
  url: r.url,
  kind: r.kind,
  method: r.method,
  issn: r.issn,
  groupLabel: r.group_label,
  taskUid: r.task_uid,
  intervalHours: r.interval_hours,
  active: r.active === 1,
  lastCheckedAt: r.last_checked_at,
  lastOkAt: r.last_ok_at,
  lastError: r.last_error,
  failures: r.failures,
  changedAt: r.changed_at,
  createdAt: r.created_at,
  newCount: r.new_count
})

/** A URL the app may fetch: http or https, nothing else (no file:, no localhost-style shortcuts). */
export function validSourceUrl(value: string): string {
  let u: URL
  try {
    u = new URL(value.trim())
  } catch {
    throw new Error('That is not a web address')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    throw new Error('Only http and https addresses can be watched')
  if (!u.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))
    throw new Error('Only public web addresses can be watched')
  u.hash = ''
  return u.toString()
}

const checkWorkspace = (workspace: string): WatchWorkspace => {
  if (!(WATCH_WORKSPACES as readonly string[]).includes(workspace))
    throw new Error('Invalid workspace')
  return workspace as WatchWorkspace
}

/** The sources of one workspace, or of every workspace when none is given (Settings lists them all). */
export function listSources(db: Database, workspace?: WatchWorkspace): WatchSource[] {
  const rows = workspace
    ? db
        .prepare(`${SOURCE_SELECT} WHERE s.workspace = ? ORDER BY s.group_label, s.title`)
        .all(checkWorkspace(workspace))
    : db.prepare(`${SOURCE_SELECT} ORDER BY s.group_label, s.title`).all()
  return (rows as SourceRow[]).map(toSource)
}

export function getSource(db: Database, id: number): WatchSource | null {
  const row = db.prepare(`${SOURCE_SELECT} WHERE s.id = ?`).get(id) as SourceRow | undefined
  return row ? toSource(row) : null
}

export function addSource(db: Database, input: NewWatchSource, now: string): WatchSource {
  const title = input.title.trim()
  if (!title) throw new Error('A source needs a name')
  if (!(WATCH_KINDS as readonly string[]).includes(input.kind)) throw new Error('Invalid kind')
  if (!(WATCH_METHODS as readonly string[]).includes(input.method))
    throw new Error('Invalid method')
  const url = validSourceUrl(input.url)
  const issn = input.issn?.trim() || null
  if (input.method === 'crossref' && !(issn && /^\d{4}-\d{3}[\dXx]$/.test(issn)))
    throw new Error('A journal needs its ISSN, like 1088-8438')
  const workspace = checkWorkspace(input.workspace ?? 'research')
  const hours = input.intervalHours ?? 24
  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 30) throw new Error('Invalid interval')
  if (db.prepare('SELECT 1 FROM watch_sources WHERE url = ?').get(url))
    throw new Error('Already watching that address')
  const info = db
    .prepare(
      `INSERT INTO watch_sources (workspace, title, url, kind, method, issn, group_label, task_uid, interval_hours, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      workspace,
      title,
      url,
      input.kind,
      input.method,
      issn,
      input.groupLabel ?? '',
      input.taskUid ?? null,
      hours,
      now
    )
  return getSource(db, Number(info.lastInsertRowid)) as WatchSource
}

export function updateSource(db: Database, id: number, changes: WatchSourceChanges): WatchSource {
  const current = getSource(db, id)
  if (!current) throw new Error('No such source')
  const next = { ...current, ...changes }
  checkWorkspace(next.workspace)
  if (!next.title.trim()) throw new Error('A source needs a name')
  if (!(WATCH_KINDS as readonly string[]).includes(next.kind)) throw new Error('Invalid kind')
  if (
    !Number.isInteger(next.intervalHours) ||
    next.intervalHours < 1 ||
    next.intervalHours > 24 * 30
  )
    throw new Error('Invalid interval')
  const url = validSourceUrl(next.url)
  if (url !== current.url) {
    const taken = db.prepare('SELECT id FROM watch_sources WHERE url = ?').get(url) as
      { id: number } | undefined
    if (taken && taken.id !== id) throw new Error('Already watching that address')
  }
  db.prepare(
    'UPDATE watch_sources SET title = ?, kind = ?, group_label = ?, interval_hours = ?, active = ?, workspace = ? WHERE id = ?'
  ).run(
    next.title.trim(),
    next.kind,
    next.groupLabel,
    next.intervalHours,
    next.active ? 1 : 0,
    next.workspace,
    id
  )
  // A new address is a new place: forget what the old one said, so its first good check is a fresh baseline.
  if (url !== current.url)
    db.prepare(
      `UPDATE watch_sources SET url = ?, last_ok_at = NULL, last_error = NULL, failures = 0, page_hash = NULL,
         changed_at = NULL, etag = NULL, last_modified = NULL WHERE id = ?`
    ).run(url, id)
  return getSource(db, id) as WatchSource
}

/** Removing a source takes its items with it (they are only copies of what the source announced). */
export function removeSource(db: Database, id: number): void {
  db.prepare('DELETE FROM watch_sources WHERE id = ?').run(id)
}

interface ItemRow {
  id: number
  source_id: number
  workspace: WatchWorkspace
  source_title: string
  kind: WatchKind
  title: string
  url: string
  summary: string
  published_at: string | null
  date: string | null
  date_kind: DateKind | null
  score: number
  matched: string
  state: WatchState
  first_seen_at: string
}

const toItem = (r: ItemRow): WatchItem => ({
  id: r.id,
  sourceId: r.source_id,
  workspace: r.workspace,
  sourceTitle: r.source_title,
  kind: r.kind,
  title: r.title,
  url: r.url,
  summary: r.summary,
  publishedAt: r.published_at,
  date: r.date,
  dateKind: r.date_kind,
  score: r.score,
  matched: r.matched ? r.matched.split(',') : [],
  state: r.state,
  firstSeenAt: r.first_seen_at
})

const ITEM_SELECT = `
  SELECT i.*, s.title AS source_title, s.workspace AS workspace, COALESCE(i.item_kind, s.kind) AS kind
  FROM watch_items i JOIN watch_sources s ON s.id = i.source_id`

/**
 * Items, the ones that need a look first: not-yet-seen before the rest, then the day they were found and the day they were published, newest first (the
 * keyword score is not shown or sorted by: keywords are not part of the page). "open" means new or saved. A `kind` the page shows (training, conference) takes in its stored kinds.
 */
export function listItems(db: Database, query: WatchItemsQuery = {}): WatchItem[] {
  const where: string[] = []
  const params: unknown[] = []
  if (query.state === 'open') where.push("i.state IN ('new', 'saved')")
  else if (query.state) {
    if (!(WATCH_STATES as readonly string[]).includes(query.state)) throw new Error('Invalid state')
    where.push('i.state = ?')
    params.push(query.state)
  }
  if (query.workspace) {
    where.push('s.workspace = ?')
    params.push(checkWorkspace(query.workspace))
  }
  if (query.sourceId !== undefined) {
    where.push('i.source_id = ?')
    params.push(query.sourceId)
  }
  if (query.kind) {
    const kinds = shownKind(query.kind) ? kindsOf(shownKind(query.kind)!) : [query.kind]
    where.push(`COALESCE(i.item_kind, s.kind) IN (${kinds.map(() => '?').join(', ')})`)
    params.push(...kinds)
  }
  if (query.relevantOnly) where.push('i.score > 0')
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 200), 1), 1000)
  const sql = `${ITEM_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY (i.state = 'new') DESC, substr(i.first_seen_at, 1, 10) DESC, COALESCE(i.published_at, i.first_seen_at) DESC, i.id DESC
    LIMIT ${limit}`
  return (db.prepare(sql).all(...params) as ItemRow[]).map(toItem)
}

export function setItemState(db: Database, id: number, state: WatchState): void {
  if (!(WATCH_STATES as readonly string[]).includes(state)) throw new Error('Invalid state')
  db.prepare('UPDATE watch_items SET state = ? WHERE id = ?').run(state, id)
}

/** Opening an item is the first look at it: a new one becomes seen (a saved or read one stays as it is). */
export function openItem(db: Database, id: number): void {
  db.prepare("UPDATE watch_items SET state = 'seen' WHERE id = ? AND state = 'new'").run(id)
}

/**
 * "Looked at everything": new items become read (saved ones stay as they are), in one source or one workspace's sources,
 * or everywhere when neither is given. Returns how many changed.
 */
export function markAllSeen(db: Database, sourceId?: number, workspace?: WatchWorkspace): number {
  const sources = (column: string): string =>
    sourceId !== undefined
      ? `${column} = ${Math.trunc(sourceId)}`
      : workspace
        ? `${column} IN (SELECT id FROM watch_sources WHERE workspace = '${checkWorkspace(workspace)}')`
        : '1'
  const info = db
    .prepare(
      `UPDATE watch_items SET state = 'seen' WHERE state = 'new' AND ${sources('source_id')}`
    )
    .run()
  db.prepare(`UPDATE watch_sources SET changed_at = NULL WHERE ${sources('id')}`).run()
  return info.changes
}

/** The counts of one workspace's sources and items, or of all of them when none is given. */
export function getCounts(db: Database, workspace?: WatchWorkspace): WatchCounts {
  const only = workspace ? checkWorkspace(workspace) : null
  const one = (sql: string): number =>
    (db.prepare(sql).get(...(only ? [only] : [])) as { n: number }).n
  const items = only
    ? 'FROM watch_items i JOIN watch_sources s ON s.id = i.source_id WHERE s.workspace = ? AND'
    : 'FROM watch_items i WHERE'
  const sources = only
    ? 'FROM watch_sources s WHERE s.workspace = ? AND'
    : 'FROM watch_sources s WHERE'
  return {
    new: one(`SELECT COUNT(*) AS n ${items} i.state = 'new'`),
    newRelevant: one(`SELECT COUNT(*) AS n ${items} i.state = 'new' AND i.score > 0`),
    sources: one(`SELECT COUNT(*) AS n ${sources} s.active = 1`),
    failing: one(`SELECT COUNT(*) AS n ${sources} s.active = 1 AND s.last_error IS NOT NULL`),
    changed: one(`SELECT COUNT(*) AS n ${sources} s.active = 1 AND s.changed_at IS NOT NULL`)
  }
}

/**
 * What has a date coming up: the items the user SAVED with a deadline or event date from `today` to `days` days on,
 * soonest first (one workspace's, or every workspace's when none is given). Only saved items: an unsaved one never reaches
 * Home's "Coming up" or a notification, however near its date.
 */
export function upcoming(
  db: Database,
  today: string,
  days: number,
  limit = 50,
  workspace?: WatchWorkspace
): WatchItem[] {
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + Math.min(Math.max(Math.trunc(days), 1), 730))
  const rows = db
    .prepare(
      `${ITEM_SELECT} WHERE i.date >= ? AND i.date <= ? AND i.state = 'saved'
       ${workspace ? 'AND s.workspace = ?' : ''}
       ORDER BY i.date, i.score DESC LIMIT ?`
    )
    .all(
      today,
      end.toISOString().slice(0, 10),
      ...(workspace ? [checkWorkspace(workspace)] : []),
      limit
    ) as ItemRow[]
  return rows.map(toItem)
}

export function getKeywords(db: Database): string[] {
  const rows = db.prepare('SELECT term FROM watch_keywords ORDER BY term').all() as {
    term: string
  }[]
  return rows.length > 0 ? rows.map((r) => r.term) : [...DEFAULT_KEYWORDS]
}

/** Replaces the keyword list. An empty list goes back to the defaults (the caller re-scores the stored items with `rescoreItems`). */
export function setKeywords(db: Database, terms: string[]): string[] {
  const clean = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 100)
  db.transaction(() => {
    db.prepare('DELETE FROM watch_keywords').run()
    const insert = db.prepare('INSERT INTO watch_keywords (term) VALUES (?)')
    for (const term of clean) insert.run(term)
  })()
  return getKeywords(db)
}
