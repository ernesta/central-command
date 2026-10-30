import type { Database } from 'better-sqlite3'
import { DEFAULT_KEYWORDS } from '../shared/relevance'
import {
  MANUAL_SOURCE_TITLE,
  STORED_SOURCE_KIND,
  WATCH_METHODS,
  WATCH_SECTIONS,
  WATCH_STATES,
  WATCH_WORKSPACES,
  sectionOf,
  type ManualItemInput,
  type NewWatchSource,
  type WatchCounts,
  type WatchItem,
  type WatchItemsQuery,
  type WatchMethod,
  type WatchSection,
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
  method: WatchMethod
  reading: string | null
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
  method: r.reading === 'event' ? 'event' : r.method,
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

/** The sources of one workspace, or of every workspace when none is given (Settings lists them all). The hidden "Added by hand" source is not one of them. */
export function listSources(db: Database, workspace?: WatchWorkspace): WatchSource[] {
  const rows = workspace
    ? db
        .prepare(
          `${SOURCE_SELECT} WHERE s.manual = 0 AND s.workspace = ? ORDER BY s.group_label, s.title`
        )
        .all(checkWorkspace(workspace))
    : db.prepare(`${SOURCE_SELECT} WHERE s.manual = 0 ORDER BY s.group_label, s.title`).all()
  return (rows as SourceRow[]).map(toSource)
}

export function getSource(db: Database, id: number): WatchSource | null {
  const row = db.prepare(`${SOURCE_SELECT} WHERE s.id = ?`).get(id) as SourceRow | undefined
  return row ? toSource(row) : null
}

export function addSource(db: Database, input: NewWatchSource, now: string): WatchSource {
  const title = input.title.trim()
  if (!title) throw new Error('A source needs a name')
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
      `INSERT INTO watch_sources (workspace, title, url, kind, method, reading, issn, group_label, task_uid, interval_hours, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      workspace,
      title,
      url,
      STORED_SOURCE_KIND,
      // The CHECK on `method` has no 'event': a page that is one event is stored as a page read as an event.
      input.method === 'event' ? 'page' : input.method,
      input.method === 'event' ? 'event' : null,
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
  if (
    !Number.isInteger(next.intervalHours) ||
    next.intervalHours < 1 ||
    next.intervalHours > 24 * 30
  )
    throw new Error('Invalid interval')
  if (changes.method !== undefined && changes.method !== current.method) {
    // Only a page and a page that is one event can be told apart by the user; a feed or a journal stays what it is.
    const pages = ['page', 'event']
    if (!pages.includes(current.method) || !pages.includes(changes.method))
      throw new Error('That source cannot be read another way')
    db.prepare('UPDATE watch_sources SET reading = ?, found_via = NULL WHERE id = ?').run(
      changes.method === 'event' ? 'event' : null,
      id
    )
  }
  const url = validSourceUrl(next.url)
  if (url !== current.url) {
    const taken = db.prepare('SELECT id FROM watch_sources WHERE url = ?').get(url) as
      { id: number } | undefined
    if (taken && taken.id !== id) throw new Error('Already watching that address')
  }
  db.prepare(
    'UPDATE watch_sources SET title = ?, group_label = ?, interval_hours = ?, active = ?, workspace = ? WHERE id = ?'
  ).run(
    next.title.trim(),
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
         changed_at = NULL, etag = NULL, last_modified = NULL, found_via = NULL WHERE id = ?`
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
  section: WatchSection | null
  manual: number
  title: string
  url: string
  summary: string
  published_at: string | null
  event_date: string | null
  event_end: string | null
  deadline: string | null
  deadline_label: string | null
  score: number
  matched: string
  state: WatchState
  first_seen_at: string
  read_at: string | null
}

const toItem = (r: ItemRow): WatchItem => ({
  id: r.id,
  sourceId: r.source_id,
  workspace: r.workspace,
  sourceTitle: r.source_title,
  section: r.section ?? sectionOf(r.title, r.summary, r.source_title),
  manual: r.manual === 1,
  title: r.title,
  url: r.url,
  summary: r.summary,
  publishedAt: r.published_at,
  eventDate: r.event_date,
  eventEnd: r.event_end,
  deadline: r.deadline,
  deadlineLabel: r.deadline_label,
  date: r.deadline ?? r.event_date,
  dateKind: r.deadline ? 'deadline' : r.event_date ? 'date' : null,
  score: r.score,
  matched: r.matched ? r.matched.split(',') : [],
  state: r.state,
  firstSeenAt: r.first_seen_at,
  readAt: r.read_at
})

const ITEM_SELECT = `
  SELECT i.*, s.title AS source_title, s.workspace AS workspace
  FROM watch_items i JOIN watch_sources s ON s.id = i.source_id`

/**
 * Items, the ones that need a look first: not-yet-seen before the rest, then the day they were found and the day they were published, newest first (the
 * keyword score is not shown or sorted by: keywords are not part of the page). "open" means new or saved. A `section` is the item's stored section.
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
  if (query.section) {
    if (!(WATCH_SECTIONS as readonly string[]).includes(query.section))
      throw new Error('Invalid section')
    where.push('i.section = ?')
    params.push(query.section)
  }
  if (query.relevantOnly) where.push('i.score > 0')
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 200), 1), 1000)
  const sql = `${ITEM_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY (i.state = 'new') DESC, CASE WHEN i.state = 'seen' THEN i.read_at END DESC, substr(i.first_seen_at, 1, 10) DESC, COALESCE(i.published_at, i.first_seen_at) DESC, i.id DESC
    LIMIT ${limit}`
  return (db.prepare(sql).all(...params) as ItemRow[]).map(toItem)
}

/**
 * Sets an item's state and its `read_at`: read now when it becomes Read, cleared when it becomes New, untouched when it is Saved.
 * An undo passes the `readAt` the item had (null for none) so the Read list's order comes back too.
 */
export function setItemState(
  db: Database,
  id: number,
  state: WatchState,
  { readAt, now = new Date().toISOString() }: { readAt?: string | null; now?: string } = {}
): void {
  if (!(WATCH_STATES as readonly string[]).includes(state)) throw new Error('Invalid state')
  if (readAt !== undefined) {
    db.prepare('UPDATE watch_items SET state = ?, read_at = ? WHERE id = ?').run(state, readAt, id)
    return
  }
  const stamp =
    state === 'seen' ? 'read_at = @now' : state === 'new' ? 'read_at = NULL' : 'read_at = read_at'
  db.prepare(`UPDATE watch_items SET state = @state, ${stamp} WHERE id = @id`).run({
    state,
    now,
    id
  })
}

/** Opening an item is the first look at it: a new one becomes seen (a saved or read one stays as it is). */
export function openItem(db: Database, id: number, now = new Date().toISOString()): void {
  db.prepare(
    "UPDATE watch_items SET state = 'seen', read_at = ? WHERE id = ? AND state = 'new'"
  ).run(now, id)
}

/**
 * "Looked at everything": new items become read (saved ones stay as they are), in one source or one workspace's sources,
 * or everywhere when neither is given. Returns how many changed.
 */
export function markAllSeen(
  db: Database,
  sourceId?: number,
  workspace?: WatchWorkspace,
  now = new Date().toISOString()
): number {
  const sources = (column: string): string =>
    sourceId !== undefined
      ? `${column} = ${Math.trunc(sourceId)}`
      : workspace
        ? `${column} IN (SELECT id FROM watch_sources WHERE workspace = '${checkWorkspace(workspace)}')`
        : '1'
  const info = db
    .prepare(
      `UPDATE watch_items SET state = 'seen', read_at = ? WHERE state = 'new' AND ${sources('source_id')}`
    )
    .run(now)
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
    ? 'FROM watch_sources s WHERE s.manual = 0 AND s.workspace = ? AND'
    : 'FROM watch_sources s WHERE s.manual = 0 AND'
  return {
    new: one(`SELECT COUNT(*) AS n ${items} i.state = 'new'`),
    newRelevant: one(`SELECT COUNT(*) AS n ${items} i.state = 'new' AND i.score > 0`),
    sources: one(`SELECT COUNT(*) AS n ${sources} s.active = 1`),
    failing: one(`SELECT COUNT(*) AS n ${sources} s.active = 1 AND s.last_error IS NOT NULL`),
    changed: one(`SELECT COUNT(*) AS n ${sources} s.active = 1 AND s.changed_at IS NOT NULL`)
  }
}

/**
 * What has a date coming up: the items the user SAVED whose date is from `today` to `days` days on, soonest first (one workspace's,
 * or every workspace's when none is given). An item's date is its deadline while that is still ahead, else its event's day. Only
 * saved items: an unsaved one never reaches Home's "Coming up" or a notification, however near its date.
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
  const last = end.toISOString().slice(0, 10)
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT x.*, CASE WHEN x.deadline >= @today THEN x.deadline ELSE x.event_date END AS coming
         FROM (${ITEM_SELECT} WHERE i.state = 'saved' ${workspace ? 'AND s.workspace = @workspace' : ''}) x
       ) WHERE coming >= @today AND coming <= @last
       ORDER BY coming, score DESC LIMIT @limit`
    )
    .all({
      today,
      last,
      limit,
      ...(workspace ? { workspace: checkWorkspace(workspace) } : {})
    }) as (ItemRow & {
    coming: string
  })[]
  return rows.map((r) => ({
    ...toItem(r),
    date: r.coming,
    dateKind: r.coming === r.deadline ? 'deadline' : 'date'
  }))
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

/** Every item that is not an entry by hand gets its section from its own words (run at launch and after a check; saved and read states are untouched). */
export function reclassifyItems(db: Database): void {
  const rows = db
    .prepare(
      `SELECT i.id, i.title, i.summary, i.section, s.title AS sourceTitle
       FROM watch_items i JOIN watch_sources s ON s.id = i.source_id WHERE i.manual = 0`
    )
    .all() as {
    id: number
    title: string
    summary: string
    section: string | null
    sourceTitle: string
  }[]
  const update = db.prepare('UPDATE watch_items SET section = ? WHERE id = ?')
  db.transaction(() => {
    for (const r of rows) {
      const section = sectionOf(r.title, r.summary, r.sourceTitle)
      if (section !== r.section) update.run(section, r.id)
    }
  })()
}

/** The workspace's hidden source for entries by hand, made on first use: inactive, never checked, not listed or counted. */
export function manualSourceId(db: Database, workspace: WatchWorkspace, now: string): number {
  const w = checkWorkspace(workspace)
  const row = db
    .prepare('SELECT id FROM watch_sources WHERE manual = 1 AND workspace = ?')
    .get(w) as { id: number } | undefined
  if (row) return row.id
  const info = db
    .prepare(
      `INSERT INTO watch_sources (workspace, title, url, kind, method, interval_hours, active, manual, created_at)
       VALUES (?, ?, ?, ?, 'page', 24, 0, 1, ?)`
    )
    .run(w, MANUAL_SOURCE_TITLE, `cc://added-by-hand/${w}`, STORED_SOURCE_KIND, now)
  return Number(info.lastInsertRowid)
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function cleanManual(input: ManualItemInput): {
  title: string
  section: WatchSection
  url: string
  summary: string
  eventDate: string | null
  eventEnd: string | null
  deadline: string | null
  deadlineLabel: string | null
} {
  const title = input.title.trim()
  if (!title) throw new Error('An entry needs a title')
  if (!(WATCH_SECTIONS as readonly string[]).includes(input.section))
    throw new Error('Invalid section')
  const url = input.url?.trim() ? validSourceUrl(input.url) : ''
  const day = (v: string | null | undefined): string | null => {
    if (!v) return null
    if (!DAY.test(v)) throw new Error('Invalid date')
    return v
  }
  const eventDate = day(input.eventDate)
  const eventEnd = eventDate ? day(input.eventEnd) : null
  if (eventDate && eventEnd && eventEnd < eventDate) throw new Error('The end is before the start')
  const deadline = day(input.deadline)
  return {
    title,
    section: input.section,
    url,
    summary: (input.summary ?? '').trim(),
    eventDate,
    eventEnd: eventEnd && eventEnd !== eventDate ? eventEnd : null,
    deadline,
    deadlineLabel: deadline ? input.deadlineLabel?.trim() || 'Apply by' : null
  }
}

function getItem(db: Database, id: number): WatchItem {
  const row = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id) as ItemRow | undefined
  if (!row) throw new Error('No such entry')
  return toItem(row)
}

/** The items with these ids (those that exist), for Home to read what a linked task's item says now. */
export function itemsByIds(db: Database, ids: readonly number[]): WatchItem[] {
  if (ids.length === 0) return []
  const marks = ids.map(() => '?').join(',')
  return (db.prepare(`${ITEM_SELECT} WHERE i.id IN (${marks})`).all(...ids) as ItemRow[]).map(
    toItem
  )
}

/** An entry added by hand: in its section like any other item, created Saved (the user put it there on purpose). */
export function createManualItem(db: Database, input: ManualItemInput, now: string): WatchItem {
  const v = cleanManual(input)
  const sourceId = manualSourceId(db, input.workspace ?? 'research', now)
  const info = db
    .prepare(
      `INSERT INTO watch_items
         (source_id, item_key, title, url, summary, published_at, event_date, event_end, deadline, deadline_label,
          score, matched, state, first_seen_at, manual, section)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, '', 'saved', ?, 1, ?)`
    )
    .run(
      sourceId,
      `manual:${now}:${Math.random().toString(36).slice(2, 8)}`,
      v.title,
      v.url,
      v.summary,
      v.eventDate,
      v.eventEnd,
      v.deadline,
      v.deadlineLabel,
      now,
      v.section
    )
  return getItem(db, Number(info.lastInsertRowid))
}

function manualOnly(db: Database, id: number): void {
  const row = db.prepare('SELECT manual FROM watch_items WHERE id = ?').get(id) as
    { manual: number } | undefined
  if (!row) throw new Error('No such entry')
  if (row.manual !== 1) throw new Error('Only an entry added by hand can be changed')
}

export function updateManualItem(db: Database, id: number, input: ManualItemInput): WatchItem {
  manualOnly(db, id)
  const v = cleanManual(input)
  db.prepare(
    `UPDATE watch_items SET title = ?, url = ?, summary = ?, event_date = ?, event_end = ?, deadline = ?,
       deadline_label = ?, section = ? WHERE id = ?`
  ).run(
    v.title,
    v.url,
    v.summary,
    v.eventDate,
    v.eventEnd,
    v.deadline,
    v.deadlineLabel,
    v.section,
    id
  )
  return getItem(db, id)
}

/** Deletes an entry added by hand and returns it, so the page can offer Undo (`restoreManualItem`). */
export function deleteManualItem(db: Database, id: number): WatchItem {
  manualOnly(db, id)
  const item = getItem(db, id)
  db.prepare('DELETE FROM watch_items WHERE id = ?').run(id)
  return item
}

/** Undo of a delete: the entry comes back as it was (same state, same day found). */
export function restoreManualItem(db: Database, item: WatchItem, now: string): WatchItem {
  if (!(WATCH_STATES as readonly string[]).includes(item.state)) throw new Error('Invalid state')
  if (typeof item.firstSeenAt !== 'string') throw new Error('Invalid entry')
  const v = cleanManual({ ...item, workspace: item.workspace })
  const sourceId = manualSourceId(db, item.workspace, now)
  const info = db
    .prepare(
      `INSERT INTO watch_items
         (source_id, item_key, title, url, summary, published_at, event_date, event_end, deadline, deadline_label,
          score, matched, state, first_seen_at, manual, section, read_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, '', ?, ?, 1, ?, ?)`
    )
    .run(
      sourceId,
      `manual:${now}:${Math.random().toString(36).slice(2, 8)}`,
      v.title,
      v.url,
      v.summary,
      v.eventDate,
      v.eventEnd,
      v.deadline,
      v.deadlineLabel,
      item.state,
      item.firstSeenAt,
      v.section,
      item.readAt ?? null
    )
  return getItem(db, Number(info.lastInsertRowid))
}
