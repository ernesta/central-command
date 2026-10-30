import type { WatchTaskLink } from '@modules/tasks/shared/watch-links'

/** What a Watch row shows about the task made from its item (`docs/WATCH_TASKS_PLAN.md`). */
export interface WatchTaskView {
  /** "Task" makes one; "Open task" goes to the open one, so a second cannot be made by accident. */
  button: 'make' | 'open'
  /** The muted "Task: <title>" link: shown whenever the row has a task, open or done. */
  note: { uid: string; title: string } | null
}

export function watchTaskView(link: WatchTaskLink | undefined): WatchTaskView {
  if (!link) return { button: 'make', note: null }
  return {
    button: link.status === 'done' ? 'make' : 'open',
    note: { uid: link.uid, title: link.title }
  }
}
