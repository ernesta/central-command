import type { NotificationSettings } from '@shared/home-settings'
import type { HomeSummary } from './types'

export interface PlannedNotification {
  /** What makes it the same notification next time: once sent, a key is never sent again. */
  key: string
  /** Other keys this one stands for (a notification about three items covers all three), recorded with it. */
  covers?: string[]
  title: string
  body: string
  /** In-app route (starts with "/"), or an https address, to open when it is clicked. */
  route: string
}

export interface NotifyState {
  /** Keys already sent. */
  sent: ReadonlySet<string>
  /** ISO time notifications were first allowed: nothing found before it is announced (turning them on does not flood). */
  since: string
}

export interface NotifyNow {
  date: string
  /** HH:MM */
  time: string
}

const minutesOf = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** "3 tasks due, 1 overdue · Supervision at 14:00": what the day holds, in a line. Empty when it holds nothing. */
export function digestLine(summary: HomeSummary): string {
  const parts: string[] = []
  if (summary.tasks.todayTotal > 0) parts.push(`${plural(summary.tasks.todayTotal, 'task')} due`)
  if (summary.tasks.overdueTotal > 0) parts.push(`${summary.tasks.overdueTotal} overdue`)
  const text = parts.join(', ')
  const next = summary.meetings.next
  const meeting =
    next && next.date === summary.today
      ? `${next.series || 'Meeting'}${next.start ? ` at ${next.start}` : ''}`
      : ''
  return [text, meeting].filter(Boolean).join(' · ')
}

/**
 * What to tell the user right now, from the page's summary, their settings and what was already told. Pure and
 * idempotent: asking again a minute later returns nothing new until the clock or the data moves. Off means off.
 */
export function planNotifications(
  summary: HomeSummary,
  settings: NotificationSettings,
  state: NotifyState,
  now: NotifyNow
): PlannedNotification[] {
  if (!settings.enabled) return []
  const out: PlannedNotification[] = []
  const add = (n: PlannedNotification): void => {
    if (!state.sent.has(n.key)) out.push(n)
  }
  const nowMin = minutesOf(now.time)

  if (settings.digestAt && nowMin >= minutesOf(settings.digestAt)) {
    const line = digestLine(summary)
    if (line) add({ key: `digest:${now.date}`, title: 'Today', body: line, route: '/research' })
  }

  const next = summary.meetings.next
  if (settings.meetingMinutesBefore > 0 && next && next.date === now.date && next.start) {
    const until = minutesOf(next.start) - nowMin
    if (until >= 0 && until <= settings.meetingMinutesBefore)
      add({
        key: `meeting:${next.workspace}:${next.id}`,
        title: next.series || 'Meeting',
        body:
          until === 0
            ? `Starts now (${next.start})`
            : `Starts in ${plural(until, 'minute')} (${next.start})`,
        route: next.route
      })
  }

  if (
    settings.timerRunningHours > 0 &&
    summary.timer &&
    summary.timer.minutes >= settings.timerRunningHours * 60
  ) {
    const t = summary.timer
    add({
      key: `timer:${t.date}:${t.time}`,
      title: 'Timer still running',
      body: `${t.label} has run for ${Math.floor(t.minutes / 60)}h ${String(t.minutes % 60).padStart(2, '0')}m`,
      route: '/research/hours'
    })
  }

  if (settings.watchRelevant && summary.watch) {
    const fresh = summary.watch.relevant.filter(
      (i) => i.state === 'new' && i.firstSeenAt >= state.since && !state.sent.has(`watch:${i.id}`)
    )
    if (fresh.length > 0) {
      // One notification for the lot; its key names the newest item, so the next batch is a new notification.
      const newest = fresh.reduce((a, b) => (b.id > a.id ? b : a))
      add({
        key: `watch:${newest.id}`,
        covers: fresh.map((i) => `watch:${i.id}`),
        title: fresh.length === 1 ? 'New in Watch' : `${fresh.length} new in Watch`,
        body:
          fresh.length === 1 ? fresh[0].title : `${fresh[0].title}, and ${fresh.length - 1} more`,
        route: '/research/watch'
      })
    }
  }

  if (settings.watchDeadlineDays > 0) {
    for (const e of summary.upcoming) {
      if (e.kind !== 'deadline' || e.inDays < 0 || e.inDays > settings.watchDeadlineDays) continue
      add({
        key: `${e.id}:${e.date}`,
        title: e.inDays === 0 ? 'Deadline today' : `Deadline in ${plural(e.inDays, 'day')}`,
        body: e.title,
        route: e.route
      })
    }
  }
  return out
}

/** Keys younger than `days` days, so the list of what was sent does not grow for ever. Keys carry their date in the map's value. */
export function pruneSent(
  sent: Record<string, string>,
  today: string,
  days = 30
): Record<string, string> {
  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  const limit = cutoff.toISOString().slice(0, 10)
  return Object.fromEntries(Object.entries(sent).filter(([, date]) => date >= limit))
}
