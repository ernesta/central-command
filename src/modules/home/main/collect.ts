import type { Database } from 'better-sqlite3'
import type { RunningTimer } from '@shared/tracking/api'
import { timeOffRows } from '@shared/tracking/timeoff'
import { dayMinutes, weekMinutes } from '@shared/tracking/totals'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { weekStartOf } from '@shared/year'
import type { Workspace } from '@shared/settings'
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

function homeTimer(tracking: TrackingSource, now: Moment): HomeTimer | null {
  const running = tracking.running()
  if (!running || running.workspace === 'life') return null
  return {
    workspace: running.workspace,
    label: running.session.label,
    date: running.session.date,
    time: running.session.start.slice(0, 5),
    minutes: timerMinutes(running, now)
  }
}

/** Research's current year: today's and this week's tracked minutes against the week's aim, and the days off still to come. */
function researchYear(tracking: TrackingSource): TrackingYear | null {
  const start = tracking.years('research')[0]
  return start ? tracking.get('research', start) : null
}

function homeHours(year: TrackingYear | null, now: Moment): HomeHours | null {
  if (!year) return null
  return {
    todayMinutes: dayMinutes(year, now.date, now),
    weekMinutes: weekMinutes(year, weekStartOf(now.date), now),
    weekAimMinutes: year.plan.hoursPerWeek
  }
}

export interface CollectDeps {
  db: Database
  tracking: TrackingSource
  /** Local date and time now. */
  now: Moment
  generatedAt: string
  weather: WeatherSummary | null
  /** Whether Watch has anything to say (it has when a source exists). */
  watch: boolean
}

/**
 * Read everything Home needs from the database and the tracking files, then let the pure builder decide. Meeting and
 * lecture subtasks are left out of the task lists: their time is the meeting's or lecture's own, and the event is
 * already in "coming up".
 */
export function collectHomeSummary(deps: CollectDeps): HomeSummary {
  const { db, now } = deps
  const tasks = db
    .prepare(
      `SELECT uid, title, workspace, list, due, priority, status FROM tasks
       WHERE deleted_at IS NULL AND status != 'done' AND due IS NOT NULL
         AND uid NOT IN (SELECT task FROM meetings WHERE task != '')
         AND uid NOT IN (SELECT task FROM training WHERE task != '' AND task != 'auto')`
    )
    .all() as TaskInput[]
  const meetings = (
    db
      .prepare(
        `SELECT workspace, meeting_id AS id, series, date, start_time AS start, end_time AS end
         FROM meetings WHERE date >= ? AND date != '' ORDER BY date, start_time`
      )
      .all(now.date) as MeetingInput[]
  ).filter((m) => m.workspace === 'research' || m.workspace === 'work')
  const trainings = db
    .prepare(
      `SELECT workspace, entry_id AS id, title, date, start_time AS start
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

  const year = researchYear(deps.tracking)
  const hasWatch = deps.watch && getCounts(db).sources > 0
  const inputs: HomeInputs = {
    today: now.date,
    nowMinutes: toMinutes(now.time),
    generatedAt: deps.generatedAt,
    tasks,
    meetings,
    trainings,
    openMeetingTodos,
    timer: homeTimer(deps.tracking, now),
    hours: homeHours(year, now),
    timeOff: year
      ? timeOffRows(year, now.date)
          .filter((r) => !r.taken)
          .map(({ date, type }) => ({ date, type }))
      : [],
    watch: hasWatch
      ? {
          counts: getCounts(db),
          relevant: listItems(db, { state: 'new', relevantOnly: true, limit: 10 }),
          upcoming: upcoming(db, now.date, 60)
        }
      : null,
    weather: deps.weather
  }
  return buildHomeSummary(inputs)
}
