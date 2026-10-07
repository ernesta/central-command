import { useEffect, useRef } from 'react'
import { useTasksList } from '../../tasks/renderer/useTasksList'
import type { Task } from '../../tasks/shared/types'
import { planLectureTask, strandedParent, type ParentTarget } from '../shared/lecture-task'
import type { TrainingMeta } from '../shared/types'

/** How long a title or series stays still before the subtask follows it. */
const SETTLE_MS = 800

async function parentUid(target: ParentTarget, made: Set<string>): Promise<string> {
  if ('uid' in target) return target.uid
  const task = await window.api.tasks.create({
    workspace: 'research',
    title: target.title,
    list: target.list
  })
  made.add(task.uid)
  return task.uid
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
  // Series tasks this page made: the series is typed letter by letter, so one may be left behind and is put in the trash.
  const made = useRef(new Set<string>())
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
            parentUid: await parentUid(plan.parent, made.current)
          })
          setTask(sub.uid)
        } else {
          const left = tasks.find((t) => t.uid === plan.uid)?.parentUid ?? null
          await window.api.tasks.update(plan.uid, {
            ...(plan.title !== undefined ? { title: plan.title } : {}),
            ...(plan.parent ? { parentUid: await parentUid(plan.parent, made.current) } : {})
          })
          if (plan.parent) {
            const stranded = strandedParent(
              made.current,
              left,
              await window.api.tasks.list('research')
            )
            if (stranded) await window.api.tasks.delete(stranded)
          }
        }
      } catch (error) {
        console.error('Could not keep the lecture task in step:', error)
      } finally {
        busy.current = false
      }
    }
    // The series and the title are typed letter by letter: nothing is made or moved until they settle.
    const timer = setTimeout(() => void run(), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [ready, tasks, task, series, title, setTask])

  return { tasks }
}
