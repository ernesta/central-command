import { useCallback, useEffect, useRef } from 'react'
import type { Task, TaskWorkspace } from '../../tasks/shared/types'
import { planSelfStudyTask } from '../shared/self-study-task'
import type { TrainingMeta } from '../shared/types'
import { makeSelfStudyTask, syncSelfStudyTask } from './self-study-sync'

/** How long a title or series stays still before the subtask follows it. */
const SETTLE_MS = 800

/**
 * Keeps a training note's self-study task in step with its title, series and date, and makes it when time is first put on it and the
 * main process has not yet (it makes one for every dated, titled entry): `ensure` is what Start and Add time call. What to do is `planSelfStudyTask`; this only does it, one thing at a time.
 */
export function useSelfStudyTask(
  meta: TrainingMeta,
  ready: boolean,
  tasks: readonly Task[] | null,
  setSelfStudy: (uid: string) => void,
  workspace: TaskWorkspace = 'research'
): { ensure: () => Promise<Task> } {
  const busy = useRef(false)
  // Series tasks this page made: the series is typed letter by letter, so one may be left behind and is put in the trash.
  const made = useRef(new Set<string>())
  const { selfStudy, series, title, date } = meta
  const latest = useRef({ selfStudy, series, title, date })
  // The task `ensure` made last: the note's `selfstudy:` follows a moment later, and a second press in between must find it, not make another.
  const ensured = useRef('')
  useEffect(() => {
    latest.current = { selfStudy, series, title, date }
  }, [selfStudy, series, title, date])

  useEffect(() => {
    if (!ready || tasks === null || busy.current || !selfStudy) return
    const plan = planSelfStudyTask({ selfStudy, series, title, date }, tasks)
    if (plan.kind !== 'sync') return
    const timer = setTimeout(() => {
      void (async () => {
        if (busy.current) return
        busy.current = true
        try {
          await syncSelfStudyTask(window.api.tasks, plan, tasks, made.current, workspace)
        } catch (error) {
          console.error('Could not keep the self-study task in step:', error)
        } finally {
          busy.current = false
        }
      })()
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [ready, tasks, selfStudy, series, title, date, workspace])

  const ensure = useCallback(async (): Promise<Task> => {
    // A sync under way finishes first, so the task is not made twice.
    for (let waited = 0; busy.current && waited < 3000; waited += 50) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    busy.current = true
    try {
      const note = latest.current
      const task = await makeSelfStudyTask(
        window.api.tasks,
        { ...note, selfStudy: note.selfStudy || ensured.current },
        made.current,
        workspace
      )
      ensured.current = task.uid
      if (task.uid !== note.selfStudy) setSelfStudy(task.uid)
      return task
    } finally {
      busy.current = false
    }
  }, [setSelfStudy, workspace])

  return { ensure }
}
