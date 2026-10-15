import type { WatchKind, WatchSuggestion } from '../shared/types'

export interface TaskForWatch {
  uid: string
  title: string
  description: string
}

export interface FromTasks {
  sources: (WatchSuggestion & { taskUid: string })[]
  /** Addresses the app cannot read by itself, and why, so the user keeps checking them by hand. */
  byHand: { taskTitle: string; line: string; reason: string }[]
  /** Lines in a reminder that name a place but give no address. */
  noAddress: { taskTitle: string; line: string }[]
}

/** The kind a "Check upcoming …" reminder is about, from its title. */
export function kindOfReminder(title: string): WatchKind {
  const t = title.toLowerCase()
  if (t.includes('summer school')) return 'summer-school'
  if (t.includes('conference')) return 'conference'
  if (t.includes('training') || t.includes('course') || t.includes('workshop')) return 'training'
  return 'other'
}

const URL_RE = /https?:\/\/[^\s)<>\]]+/gi

/** A place the app cannot open: a page behind a login, a shared folder or document, a campus intranet. */
function unreadable(url: string): string | null {
  const host = new URL(url).hostname
  if (/(^|\.)box\.com$|\.app\.box\.com$/.test(host))
    return 'a shared Box folder (needs the browser)'
  if (host === 'docs.google.com' || host === 'drive.google.com')
    return 'a Google document (needs your sign-in)'
  if (/^intranet\./.test(host)) return 'a university intranet page (needs your sign-in)'
  if (/sona-systems\.com$/.test(host)) return 'a sign-up site (needs your sign-in)'
  return null
}

function titleFor(url: string, group: string): string {
  const u = new URL(url)
  const host = u.hostname.replace(/^www\./, '')
  const path = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).slice(-1)[0]
  const tail = path ? ` · ${decodeURIComponent(path).replace(/[-_]+/g, ' ')}` : ''
  return `${host}${tail}`.slice(0, 80) || group
}

/**
 * The addresses in the user's "Check upcoming …" reminders: what they open by hand every month. Only reminders that
 * start with "Check upcoming" are read; each address in the description becomes a suggested source, grouped under the
 * reminder's title. Pure: it reads nothing and writes nothing.
 */
export function sourcesFromTasks(tasks: TaskForWatch[]): FromTasks {
  const out: FromTasks = { sources: [], byHand: [], noAddress: [] }
  const seen = new Set<string>()
  for (const task of tasks) {
    if (!/^check upcoming\b/i.test(task.title)) continue
    const kind = kindOfReminder(task.title)
    for (const rawLine of task.description.split('\n')) {
      const line = rawLine.replace(/^\s*[-*]\s*/, '').trim()
      if (!line) continue
      const urls = [...line.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:]+$/, ''))
      if (urls.length === 0) {
        out.noAddress.push({ taskTitle: task.title, line })
        continue
      }
      for (const url of urls) {
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          continue
        }
        const key = parsed.toString()
        if (seen.has(key)) continue
        seen.add(key)
        const why = unreadable(key)
        if (why) {
          out.byHand.push({ taskTitle: task.title, line: key, reason: why })
          continue
        }
        out.sources.push({
          title: titleFor(key, task.title),
          url: key,
          kind,
          method: 'page',
          groupLabel: task.title,
          taskUid: task.uid
        })
      }
    }
  }
  return out
}
