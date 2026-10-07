import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { isDeepStrictEqual } from 'util'
import { writeFileAtomicSync } from '../../../../main/atomic-write'
import { applyChanges, parseMeta, splitNote } from '../../shared/front-matter'

/**
 * One-off (7 Oct 2026, agreed with the user line by line): each Work meeting note is linked to the task that already holds its
 * hours, and the two 0-minute Liberia timer sessions of 5 Oct to their task. Nothing is created and no hours change: the notes get a
 * `task:` line and the sessions a `task` key. A note's times stay for the Supervision log, and `withDerived` adds no hours for a note
 * whose task already has history on its day.
 */
export interface NoteLink {
  /** The note's file in `notes/meetings/work/`. */
  file: string
  /** The task's uid. */
  uid: string
}

export const WORK_MEETING_LINKS: NoteLink[] = [
  { file: '2025-10-06 Impact.md', uid: 'jjfe8nag' },
  { file: '2025-10-20 Impact.md', uid: '7n42rh57' },
  { file: '2025-11-03 Impact.md', uid: 'z29safyy' },
  { file: '2025-11-04 Impact.md', uid: 'usywwqtp' },
  { file: '2025-11-04 Impact 2.md', uid: 'xpn83hpy' },
  { file: '2025-11-17 Impact.md', uid: 'cmhp63nf' },
  { file: '2025-12-01 Impact.md', uid: 'qxdh9qc3' },
  { file: '2025-12-19 Impact.md', uid: 'fxee22u7' },
  { file: '2026-01-19 Impact.md', uid: '2k7w2vzb' },
  { file: '2026-02-02 Impact.md', uid: 'keaafgsg' },
  { file: '2026-02-09 Impact.md', uid: 'mpyp4bdb' },
  { file: '2026-02-19 Impact.md', uid: 'kj9fetxc' },
  { file: '2026-03-09 Impact.md', uid: 'fjjnc2q9' },
  { file: '2026-03-12 Impact.md', uid: 'wdpbrwg8' },
  { file: '2026-05-21 Impact.md', uid: 'rwfwwcc5' },
  { file: '2026-06-04 Impact.md', uid: 'acfaeq6u' },
  { file: '2026-06-18 Impact.md', uid: 's7axckr5' },
  { file: '2026-07-03 Document Automation – Luminos.md', uid: 'wwxewwph' },
  { file: '2026-07-09 Impact.md', uid: '28e2q46f' },
  { file: '2026-09-29 Document Automation – Vecten.md', uid: 'bvq7fmsz' },
  { file: '2026-09-30 Document Automation – Other.md', uid: 'bvq7fmsz' },
  { file: '2026-10-02 Royal Holloway.md', uid: 'uc8k3frf' },
  { file: '2026-10-05 Document Automation – Luminos.md', uid: 'hwugqgc4' }
]

/** The two 0-minute timer sessions of 5 Oct (in the contract file that starts 2026-05-01) and the task of the session beside them. */
export const WORK_TIMER_LINKS = {
  file: '2026-05-01.json',
  ids: ['a8955001', '6846d0c1'],
  uid: '8tfax5hc'
}

export interface TaskInfo {
  title: string
  list: string
}

export type NotePlan =
  { kind: 'link'; next: string } | { kind: 'already' } | { kind: 'conflict'; has: string }

/** What a note needs: the `task:` line, nothing else changed. A note that holds another task is never changed. */
export function planNoteLink(text: string, uid: string): NotePlan {
  const { meta } = parseMeta(splitNote(text).head)
  if (meta.task === uid) return { kind: 'already' }
  if (meta.task !== '') return { kind: 'conflict', has: meta.task }
  return { kind: 'link', next: applyChanges(text, { meta: { task: uid } }) }
}

export type SessionPlan =
  { kind: 'link'; next: string } | { kind: 'already' } | { kind: 'problem'; problem: string }

/** The contract file's text with `task` set on the listed sessions. Anything that already has a task is never changed. */
export function planSessionLinks(text: string, ids: readonly string[], uid: string): SessionPlan {
  type Shape = { sessions?: { id?: string; task?: string }[] }
  try {
    JSON.parse(text)
  } catch {
    return { kind: 'problem', problem: 'not JSON' }
  }
  const key = `cc://task/${uid}`
  const next = JSON.parse(text) as Shape
  let changed = 0
  for (const id of ids) {
    const s = next.sessions?.find((x) => x.id === id)
    if (!s) return { kind: 'problem', problem: `session ${id} not found` }
    if (s.task === key) continue
    if (s.task) return { kind: 'problem', problem: `session ${id} already has ${s.task}` }
    s.task = key
    changed++
  }
  if (changed === 0) return { kind: 'already' }
  // Only the new `task` keys may differ.
  const check = JSON.parse(JSON.stringify(next)) as Shape
  for (const id of ids) {
    const s = check.sessions?.find((x) => x.id === id)
    if (s) delete s.task
  }
  const before = JSON.parse(text) as Shape
  for (const id of ids) {
    const s = before.sessions?.find((x) => x.id === id)
    if (s) delete s.task
  }
  if (!isDeepStrictEqual(check, before))
    return { kind: 'problem', problem: 'the result would differ in more than the task' }
  return { kind: 'link', next: JSON.stringify(next, null, 2) + '\n' }
}

export interface LinkReport {
  lines: string[]
  /** Notes (and session files) that were or would be changed. */
  changed: number
  backup: string | null
  ok: boolean
}

/**
 * Plans every link and, when `apply`, writes them. All or nothing: any problem (a task that is not a live Work task, a missing
 * file, a note that holds another task) stops before the first write. Backs `notes/meetings/work` and `time/work` up first and reads
 * every file back.
 */
export function linkWorkMeetings(
  root: string,
  apply: boolean,
  stamp: string,
  taskOf: (uid: string) => TaskInfo | null
): LinkReport {
  const report: LinkReport = { lines: [], changed: 0, backup: null, ok: true }
  const notesDir = join(root, 'notes', 'meetings', 'work')
  const timeDir = join(root, 'time', 'work')
  const writes: { path: string; next: string }[] = []
  const bad = (line: string): void => {
    report.lines.push(line)
    report.ok = false
  }
  const taskLabel = (uid: string): string | null => {
    const t = taskOf(uid)
    return t ? `${t.title} [${t.list}]` : null
  }

  for (const { file, uid } of WORK_MEETING_LINKS) {
    const label = taskLabel(uid)
    if (!label) {
      bad(`${file}: task ${uid} is not a live Work task`)
      continue
    }
    const path = join(notesDir, file)
    if (!existsSync(path)) {
      bad(`${file}: no such note`)
      continue
    }
    const plan = planNoteLink(readFileSync(path, 'utf8'), uid)
    if (plan.kind === 'conflict') bad(`${file}: already has task ${plan.has}, left alone`)
    else if (plan.kind === 'already') report.lines.push(`${file}: already linked to ${label}`)
    else {
      report.lines.push(`${file}: -> ${label}`)
      writes.push({ path, next: plan.next })
    }
  }

  const timer = WORK_TIMER_LINKS
  const timerLabel = taskLabel(timer.uid)
  const timerPath = join(timeDir, timer.file)
  if (!timerLabel) bad(`${timer.file}: task ${timer.uid} is not a live Work task`)
  else if (!existsSync(timerPath)) bad(`${timer.file}: no such contract file`)
  else {
    const plan = planSessionLinks(readFileSync(timerPath, 'utf8'), timer.ids, timer.uid)
    if (plan.kind === 'problem') bad(`${timer.file}: ${plan.problem}`)
    else if (plan.kind === 'already') report.lines.push(`${timer.file}: timers already linked`)
    else {
      report.lines.push(`${timer.file}: ${timer.ids.length} timer sessions -> ${timerLabel}`)
      writes.push({ path: timerPath, next: plan.next })
    }
  }

  report.changed = writes.length
  if (!report.ok || !apply || writes.length === 0) return report

  report.backup = join(root, 'backups', `work-meeting-links-${stamp}`)
  mkdirSync(report.backup, { recursive: true })
  cpSync(notesDir, join(report.backup, 'notes-meetings-work'), { recursive: true })
  cpSync(timeDir, join(report.backup, 'time-work'), { recursive: true })
  for (const w of writes) writeFileAtomicSync(w.path, w.next)
  for (const w of writes) {
    if (readFileSync(w.path, 'utf8') !== w.next) bad(`read-back differs: ${w.path}`)
  }
  return report
}
