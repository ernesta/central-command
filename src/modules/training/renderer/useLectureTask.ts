import { useEffect, useRef } from 'react'
import { useTasksList } from '../../tasks/renderer/useTasksList'
import type { Task } from '../../tasks/shared/types'
import { planLectureTask, type ParentTarget } from '../shared/lecture-task'
import type { TrainingMeta } from '../shared/types'

/** How long a title or series stays still before the subtask follows it. */
const SETTLE_MS = 500

async function parentUid(target: ParentTarget): Promise<string> {
  if ('uid' in target) return target.uid
  const made = await window.api.tasks.create({
    workspace: 'research',
    title: target.title,
    list: target.list
  })
  return made.uid
}

/**
 * Keeps a training note's lecture task in step, with no clicking. A note made in the app starts marked `auto`; the moment it has a
 * series, its subtask is made under the series task (found, or made). After that the subtask follows the note: its title is the
 * note's title and it sits under the task the series names. An older note is never touched. What to do is `planLectureTask`; this
 * only does it, one thing at a time.
 */
export function useLectureTask(
  meta: TrainingMeta,
  ready: boolean,
  setTask: (uid: string) => void
): { tasks: Task[] | null } {
  const { tasks } = useTasksList('research')
  const busy = useRef(false)
  const { task, series, title } = meta

  useEffect(() => {
    if (!ready || tasks === null || busy.current) return
    const plan = planLectureTask({ task, series, title }, tasks)
    if (plan.kind === 'none') return
    const run = async (): Promise<void> => {
      busy.current = true
      try {
        if (plan.kind === 'create') {
          const sub = await window.api.tasks.create({
            workspace: 'research',
            title: plan.title,
            parentUid: await parentUid(plan.parent)
          })
          setTask(sub.uid)
        } else {
          await window.api.tasks.update(plan.uid, {
            ...(plan.title !== undefined ? { title: plan.title } : {}),
            ...(plan.parent ? { parentUid: await parentUid(plan.parent) } : {})
          })
        }
      } catch (error) {
        console.error('Could not keep the lecture task in step:', error)
      } finally {
        busy.current = false
      }
    }
    // Making the subtask is not worth waiting for; following a title being typed waits until it settles.
    if (plan.kind === 'create') {
      void run()
      return
    }
    const timer = setTimeout(() => void run(), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [ready, tasks, task, series, title, setTask])

  return { tasks }
}
