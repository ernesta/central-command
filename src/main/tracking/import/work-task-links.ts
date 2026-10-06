/**
 * Match Work's imported hour entries to the tasks they were worked on, by the numbers: a task's ClickUp time is the sum of the
 * entries that belong to it, so a set of entries is linked only when its minutes add up to the task's time exactly. Wording
 * (shared words, weighted by how rare they are) and dates (an entry falls shortly before the task's due date) only choose
 * between sets that already add up. Pure: no files, no database.
 */
import type { Change, TrackingYear } from '@shared/tracking/types'
import { taskKey } from '@modules/tasks/shared/tracked'

export interface LinkTask {
  uid: string
  title: string
  /** ClickUp's time for the task, in minutes (`earlier_minutes`). */
  minutes: number
  /** YYYY-MM-DD: the due date, else the day it was created. */
  date: string
  /** Billable by its own tag or its parent's. */
  billable: boolean
}

export interface LinkEntry {
  /** Unique across the files given (the file's start plus the entry id). */
  key: string
  date: string
  label: string
  minutes: number
}

export type Confidence = 'high' | 'medium' | 'low'

export interface Link {
  task: LinkTask
  entries: LinkEntry[]
  confidence: Confidence
}

export interface LinkPlan {
  links: Link[]
  /** Timed tasks (billable) that no set of entries reaches exactly. */
  unmatched: LinkTask[]
  /** Billable timed tasks whose best set is no better than another: left alone. */
  ambiguous: { task: LinkTask; sets: LinkEntry[][] }[]
  /** Not billable but their numbers match: listed, never linked. */
  notBillable: Link[]
}

// Generic words and the verbs titles start with carry no meaning for a match.
const STOP = new Set(
  'a an the for of to and in on with draft review complete provide prepare preparation update create write finalize define develop'.split(
    ' '
  )
)
const tokens = (text: string): Set<string> =>
  new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w))
  )

const DAY = 86_400_000
const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY

/** (words in common, weighted by rarity) divided by the weight of the shorter text, 0 to 1. */
function makeSimilarity(texts: string[]): (a: string, b: string) => number {
  const df = new Map<string, number>()
  for (const text of texts) for (const w of tokens(text)) df.set(w, (df.get(w) ?? 0) + 1)
  const weight = (w: string): number => Math.log(1 + texts.length / (df.get(w) ?? 1))
  return (a, b) => {
    const A = tokens(a)
    const B = tokens(b)
    if (A.size === 0 || B.size === 0) return 0
    let shared = 0
    let wa = 0
    let wb = 0
    for (const w of A) {
      wa += weight(w)
      if (B.has(w)) shared += weight(w)
    }
    for (const w of B) wb += weight(w)
    return shared / Math.min(wa, wb)
  }
}

// An entry may lie this many days after the due date (a task is often closed a day early) or this many before it.
const SLACK_AFTER = 3
const TIERS: { threshold: number; window: number; confidence: Confidence; most: number }[] = [
  { threshold: 0.8, window: 30, confidence: 'high', most: 4 },
  { threshold: 0.5, window: 45, confidence: 'medium', most: 4 },
  { threshold: 0.3, window: 60, confidence: 'low', most: 3 }
]
const CANDIDATES = 20
// Two sets whose scores are this close cannot be told apart.
const TIE = 0.03

interface Candidate {
  entry: LinkEntry
  sim: number
  gap: number
}

/** Every set of at most `most` candidates that adds up to the target, the fewest entries first. */
function sets(candidates: Candidate[], target: number, most: number): Candidate[][] {
  const found: Candidate[][] = []
  const walk = (from: number, chosen: Candidate[], sum: number): void => {
    if (sum === target) {
      found.push(chosen)
      return
    }
    if (chosen.length === most) return
    for (let i = from; i < candidates.length; i++) {
      const next = sum + candidates[i].entry.minutes
      if (next <= target) walk(i + 1, [...chosen, candidates[i]], next)
    }
  }
  walk(0, [], 0)
  const fewest = Math.min(...found.map((s) => s.length))
  return found.filter((s) => s.length === fewest)
}

const score = (set: Candidate[]): number => {
  const mean = (f: (c: Candidate) => number): number =>
    set.reduce((a, c) => a + f(c), 0) / set.length
  return mean((c) => c.sim) - 0.004 * mean((c) => Math.abs(c.gap))
}

export function planTaskLinks(tasks: readonly LinkTask[], entries: readonly LinkEntry[]): LinkPlan {
  const similarity = makeSimilarity([...entries.map((e) => e.label), ...tasks.map((t) => t.title)])
  const taken = new Set<string>()
  const done = new Map<string, Link>()
  const timed = tasks.filter((t) => t.minutes > 0)

  const candidatesFor = (task: LinkTask, threshold: number, window: number): Candidate[] => {
    const due = dayNumber(task.date)
    const out: Candidate[] = []
    for (const entry of entries) {
      if (taken.has(entry.key) || entry.minutes <= 0) continue
      const gap = due - dayNumber(entry.date)
      if (gap < -SLACK_AFTER || gap > window) continue
      const sim = similarity(task.title, entry.label)
      if (sim >= threshold) out.push({ entry, sim, gap })
    }
    return out.sort((a, b) => b.sim - a.sim || a.gap - b.gap).slice(0, CANDIDATES)
  }

  const ambiguous = new Map<string, LinkEntry[][]>()
  for (const tier of TIERS) {
    // Each pass proposes a set for every task still open, then settles proposals that want the same entry: a clearly better
    // one wins, a tie leaves both alone. Taking entries settles other ties, so go round until nothing changes.
    for (let changed = true; changed;) {
      changed = false
      const proposals: { task: LinkTask; set: LinkEntry[]; v: number }[] = []
      for (const t of timed) {
        if (done.has(t.uid)) continue
        const found = sets(candidatesFor(t, tier.threshold, tier.window), t.minutes, tier.most)
        if (found.length === 0) continue
        const ranked = found.map((s) => ({ s, v: score(s) })).sort((a, b) => b.v - a.v)
        if (ranked.length > 1 && ranked[0].v - ranked[1].v < TIE) {
          ambiguous.set(
            t.uid,
            ranked.slice(0, 3).map((r) => r.s.map((x) => x.entry))
          )
          continue
        }
        ambiguous.delete(t.uid)
        proposals.push({ task: t, set: ranked[0].s.map((x) => x.entry), v: ranked[0].v })
      }
      for (const p of proposals) {
        const rivals = proposals.filter(
          (o) => o !== p && o.set.some((e) => p.set.includes(e)) && o.v >= p.v - TIE
        )
        if (rivals.length > 0) {
          ambiguous.set(p.task.uid, [p.set])
          continue
        }
        // A better rival may have been settled earlier in this loop; check the entries are still free.
        if (p.set.some((e) => taken.has(e.key))) continue
        for (const e of p.set) taken.add(e.key)
        ambiguous.delete(p.task.uid)
        done.set(p.task.uid, { task: p.task, entries: p.set, confidence: tier.confidence })
        changed = true
      }
    }
  }

  const all = timed.flatMap((t) => done.get(t.uid) ?? [])
  const billableTimed = timed.filter((t) => t.billable)
  return {
    links: all.filter((l) => l.task.billable),
    notBillable: all.filter((l) => !l.task.billable),
    unmatched: billableTimed.filter((t) => !done.has(t.uid) && !ambiguous.has(t.uid)),
    ambiguous: billableTimed
      .filter((t) => !done.has(t.uid) && ambiguous.has(t.uid))
      .map((task) => ({ task, sets: ambiguous.get(task.uid) as LinkEntry[][] }))
  }
}

/**
 * Mark entries of a year as the time of tasks: each gets the task's key and `earlier` (ClickUp's time already holds it).
 * Nothing else changes (not the minutes, date, label or client). Refuses the whole change when an entry is missing or
 * already linked, so a second run can never move or double a link.
 */
export function linkEntries(year: TrackingYear, links: { id: string; uid: string }[]): Change {
  const wanted = new Map(links.map((l) => [l.id, l.uid]))
  if (wanted.size !== links.length) return { ok: false, reason: 'duplicate-entry' }
  const seen = new Set<string>()
  const adjusts = year.adjusts.map((a) => {
    const uid = wanted.get(a.id)
    if (uid === undefined) return a
    seen.add(a.id)
    return a.task || a.earlier ? null : { ...a, task: taskKey(uid), earlier: true as const }
  })
  if (adjusts.includes(null)) return { ok: false, reason: 'already-linked' }
  if (seen.size !== wanted.size) return { ok: false, reason: 'missing-entry' }
  return { ok: true, year: { ...year, adjusts: adjusts as typeof year.adjusts } }
}
