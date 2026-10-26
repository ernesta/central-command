import type { HomeSummary } from './types'

/**
 * The small file a Mac widget reads. Plain JSON, versioned, no more than a widget draws: nothing the widget has to
 * work out, and nothing it is not meant to show. Written next to the app's other data; it never leaves the Mac.
 */
export interface WidgetHours {
  label: 'This week' | 'This month'
  minutes: number
  aimMinutes: number
  todayMinutes: number
  clients: { client: string | null; minutes: number }[]
}

export interface WidgetSnapshot {
  version: 1
  generatedAt: string
  today: string
  timer: { label: string; minutes: number } | null
  /** Overdue first, then due today; at most five. */
  tasks: { title: string; list: string; overdue: boolean }[]
  taskCounts: { overdue: number; today: number }
  nextMeeting: { title: string; date: string; time: string | null } | null
  /** Research's time so far (the week), counted as the Hours page counts it: derived hours included. */
  week: WidgetHours | null
  /** Work's time so far (the invoice month or week), the same way; added without a version bump while nothing reads the file. */
  work: WidgetHours | null
  /** New Watch items, not yet looked at. */
  watchNew: number
  weather: {
    temperature: number
    unit: 'celsius' | 'fahrenheit'
    description: string
    place: string
  } | null
}

export const WIDGET_TASKS = 5

export function buildWidgetSnapshot(summary: HomeSummary): WidgetSnapshot {
  const tasks = [
    ...summary.tasks.overdue.map((t) => ({ title: t.title, list: t.list, overdue: true })),
    ...summary.tasks.today.map((t) => ({ title: t.title, list: t.list, overdue: false }))
  ].slice(0, WIDGET_TASKS)
  const m = summary.meetings.next
  return {
    version: 1,
    generatedAt: summary.generatedAt,
    today: summary.today,
    timer: summary.timer ? { label: summary.timer.label, minutes: summary.timer.minutes } : null,
    tasks,
    taskCounts: { overdue: summary.tasks.overdueTotal, today: summary.tasks.todayTotal },
    nextMeeting: m ? { title: m.series || 'Meeting', date: m.date, time: m.start } : null,
    week: summary.hours.research,
    work: summary.hours.work,
    watchNew: summary.watch?.counts.new ?? 0,
    weather: summary.weather
      ? {
          temperature: summary.weather.now.temperature,
          unit: summary.weather.unit,
          description: summary.weather.now.description,
          place: summary.weather.place
        }
      : null
  }
}
