import type { Database } from 'better-sqlite3'
import type { RunningTimer } from '@shared/tracking/api'
import { timeOffRows } from '@shared/tracking/timeoff'
import { openContracts } from '@shared/tracking/contracts'
import { yearToShow } from '@shared/tracking/current-year'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { inContract } from '@shared/tracking/workspace-weeks'
import type { Workspace } from '@shared/settings'
import { shownYear } from '../../hours/shared/shown-year'
import { periodFigures } from '../../hours/shared/so-far'
import { listMeetingRows } from '../../meetings/main/repository'
import { listTasks } from '../../tasks/main/repository'
import { listLabel } from '../../tasks/shared/query'
import { taskUidOf } from '../../tasks/shared/tracked'
import { STUDY_LINE, studyNameOf } from '../../tasks/shared/study-label'
import { hiddenTaskUids, studySeriesUids } from '../../tasks/shared/session-lock'
import { workClients } from '../../tasks/shared/work-lists'
import { listTrainingRows } from '../../training/main/repository'
import { getCounts, listItems, upcoming } from '../../watch/main/repository'
import {
  buildHomeSummary,
  daysFrom,
  type HomeInputs,
  type MeetingInput,
  type TaskInput,
  type TrainingInput
} from '../shared/summary'
import type { HomeHours, HomeSummary, HomeTimer, WeatherSummary } from '../shared/types'

/** The part of the tracking store Home reads. */
export interface TrackingSource {
  running(): RunningTimer | null
  years(workspace: Workspace): string[]
  get(workspace: Workspace, year: string): TrackingYear
}

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Whole minutes the running timer has run, across midnight and the day-end hour. */
export function timerMinutes(runner: RunningTimer, now: Moment): number {
  const days = daysFrom(runner.session.date, now.date)
  return Math.max(0, days * 1440 + toMinutes(now.time) - toMinutes(runner.session.start))
}

function homeTimer(db: Database, tracking: TrackingSource, now: Moment): HomeTimer | null {
  const running = tracking.running()
  if (!running || running.workspace === 'life') return null
  const uid = running.session.task ? taskUidOf(running.session.task) : null
  const own = uid
    ? (db
        .prepare(
          `SELECT t.title, t.own_kind AS ownKind, p.title AS parentTitle
           FROM tasks t LEFT JOIN tasks p ON p.uid = t.parent_uid WHERE t.uid = ?`
        )
        .get(uid) as
        { title: string; ownKind: string | null; parentTitle: string | null } | undefined)
    : undefined
  return {
    workspace: running.workspace,
    // A self-study task is named as its training, as everywhere else.
    label:
      own?.ownKind === 'self-study'
        ? studyNameOf(own.title, own.parentTitle)
        : running.session.label,
    date: running.session.date,
    time: running.session.start.slice(0, 5),
    minutes: timerMinutes(running, now)
  }
}

/**
 * A workspace's year as the Hours page opens it, with the hours its notes derive added: the one `yearToShow` picks (today must be
 * in it), read through `shownYear`, so every figure is the Hours page's. Read only. Null when there is no such year.
 */
function shownYearOf(
  db: Database,
  tracking: TrackingSource,
  workspace: 'research' | 'work',
  now: Moment,
  yearStarts: readonly string[]
): TrackingYear | null {
  const starts = tracking.years(workspace)
  const files = workspace === 'work' ? starts.map((s) => tracking.get(workspace, s)) : []
  const start = yearToShow(workspace, now.date, {
    yearStarts,
    years: starts,
    open: workspace === 'work' ? openContracts(files, now.date) : null
  })
  if (!start || !starts.includes(start)) return null
  const stored = files.find((f) => f.start === start) ?? tracking.get(workspace, start)
  if (!inContract(now.date, stored)) return null
  return shownYear(stored, {
    meetings: listMeetingRows(db, workspace),
    trainings: workspace === 'research' ? listTrainingRows(db, 'research') : [],
    tasks: listTasks(db, workspace),
    clients: workspace === 'work' ? workClients(files.map((f) => f.plan)) : null,
    today: now.date
  })
}

function homeHours(year: TrackingYear | null, now: Moment): HomeHours | null {
  if (!year) return null
  const f = periodFigures(year, now)
  return {
    label: f.label,
    minutes: f.minutes,
    aimMinutes: f.aim,
    todayMinutes: f.today,
    clients: f.clients
  }
}

export interface CollectDeps {
  db: Database
  tracking: TrackingSource
  /** Local date and time now. */
  now: Moment
  generatedAt: string
  weather: WeatherSummary | null
  /** The settings' year starts: which year Research is in. */
  yearStarts: readonly string[]
  /** Whether Watch has anything to say (it has when a source exists). */
  watch: boolean
}

/**
 * Read everything Home needs from the database and the tracking files, then let the pure builder decide. Meeting and
 * training subtasks are left out of the task lists: their time is the meeting's or training's own, and the event is
 * already in "coming up".
 */
export function collectHomeSummary(deps: CollectDeps): HomeSummary {
  const { db, now } = deps
  // Meetings' and trainings' own tasks (and the series task over them) are never shown as tasks: their events are.
  const all = (['research', 'work'] as const).flatMap((w) => listTasks(db, w))
  const hidden = new Set([...hiddenTaskUids(all), ...studySeriesUids(all)])
  const tasks = (
    db
      .prepare(
        `SELECT t.uid, t.title, t.workspace, t.due, t.priority, t.status,
              CASE WHEN t.own_kind = 'self-study' THEN NULL ELSE p.title END AS parent,
              CASE WHEN t.own_kind = 'self-study' THEN NULL ELSE t.parent_uid END AS parentUid,
              CASE WHEN t.own_kind = 'self-study' THEN NULL ELSE p.status END AS parentStatus,
              CASE WHEN t.own_kind = 'self-study' THEN NULL ELSE p.priority END AS parentPriority,
              CASE WHEN t.own_kind = 'self-study' THEN NULL ELSE p.due END AS parentDue,
              t.own_kind AS ownKind, p.title AS parentTitle,
              CASE WHEN t.parent_uid IS NULL THEN t.list ELSE COALESCE(p.list, '') END AS list,
              CASE WHEN t.parent_uid IS NULL THEN t.sublist ELSE COALESCE(p.sublist, '') END AS sublist
       FROM tasks t LEFT JOIN tasks p ON p.uid = t.parent_uid
       WHERE t.deleted_at IS NULL AND t.status != 'done' AND t.due IS NOT NULL
         AND t.uid NOT IN (SELECT task FROM meetings WHERE task != '')
         AND t.uid NOT IN (SELECT task FROM training WHERE task != '' AND task != 'auto')`
      )
      .all() as (TaskInput & {
      sublist: string
      ownKind: string | null
      parentTitle: string | null
    })[]
  )
    .filter((t) => !hidden.has(t.uid))
    .map(({ sublist, ownKind, parentTitle, ...t }): TaskInput =>
      // A self-study task is shown as its training: that name, and "Training · self-study" where a list would be.
      ownKind === 'self-study'
        ? { ...t, title: studyNameOf(t.title, parentTitle), list: STUDY_LINE, study: true }
        : { ...t, list: listLabel(t.list, sublist) }
    )
  const meetings = (
    db
      .prepare(
        `SELECT workspace, meeting_id AS id, series, date, start_time AS start, end_time AS end, mode, attendees
         FROM meetings WHERE date >= ? AND date != '' ORDER BY date, start_time`
      )
      .all(now.date) as (Omit<MeetingInput, 'attendees'> & { attendees: string })[]
  )
    .filter((m) => m.workspace === 'research' || m.workspace === 'work')
    .map((m): MeetingInput => ({ ...m, attendees: JSON.parse(m.attendees) as string[] }))
  const trainings = db
    .prepare(
      `SELECT workspace, entry_id AS id, title, date, start_time AS start, end_time AS end, mode
       FROM training WHERE date >= ? ORDER BY date, start_time`
    )
    .all(now.date) as TrainingInput[]
  const openMeetingTodos = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM meeting_todos t JOIN meetings m ON m.id = t.meeting_pk
         WHERE t.kind = 'inline' AND t.done = 0 AND m.workspace = 'research' AND m.date <= ?`
      )
      .get(now.date) as { n: number }
  ).n

  const research = shownYearOf(db, deps.tracking, 'research', now, deps.yearStarts)
  const work = shownYearOf(db, deps.tracking, 'work', now, deps.yearStarts)
  const hasWatch = deps.watch && getCounts(db).sources > 0
  const inputs: HomeInputs = {
    today: now.date,
    nowMinutes: toMinutes(now.time),
    generatedAt: deps.generatedAt,
    tasks,
    meetings,
    trainings,
    openMeetingTodos,
    timer: homeTimer(db, deps.tracking, now),
    hours: { research: homeHours(research, now), work: homeHours(work, now) },
    timeOff: research
      ? timeOffRows(research, now.date)
          .filter((r) => !r.taken)
          .map(({ date, type }) => ({ date, type }))
      : [],
    watch: hasWatch
      ? {
          counts: getCounts(db),
          fresh: listItems(db, { state: 'new', limit: 50 }),
          upcoming: upcoming(db, now.date, 60)
        }
      : null,
    weather: deps.weather
  }
  return buildHomeSummary(inputs)
}
