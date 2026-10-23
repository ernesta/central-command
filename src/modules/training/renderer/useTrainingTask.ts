import { useEffect, useRef } from 'react'
import { useTasksList } from '../../tasks/renderer/useTasksList'
import type { Task } from '../../tasks/shared/types'
import {
  planTrainingTask,
  strandedParent,
  TRAINING_LIST,
  type ParentTarget
} from '../shared/training-task'
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
 * Keeps a training note's training task in step, with no clicking. A note made in the app starts marked `auto`; the moment it has a
 * series, its subtask is made under the series task (found, or made). After that the subtask follows the note: its title is the
 * note's title and it sits under the task the series names. An older note is never touched. What to do is `planTrainingTask`; this
 * only does it, one thing at a time.
 */
export function useTrainingTask(
  meta: TrainingMeta,
  ready: boolean,
  setTask: (uid: string) => void
): { tasks: Task[] | null } {
  const { tasks } = useTasksList('research')
  const busy = useRef(false)
  // Series tasks this page made: the series is typed letter by letter, so one may be left behind and is put in the trash.
  const made = useRef(new Set<string>())
  const { task, series, title, date } = meta

  useEffect(() => {
    if (!ready || tasks === null || busy.current) return
    const plan = planTrainingTask({ task, series, title, date }, tasks)
    if (plan.kind === 'none') return
    const run = async (): Promise<void> => {
      busy.current = true
      try {
        if (plan.kind === 'create') {
          const sub = await window.api.tasks.create({
            workspace: 'research',
            title: plan.title,
            status: 'doing',
            ownKind: 'training',
            ...(plan.due ? { due: plan.due } : {}),
            ...(plan.parent
              ? { parentUid: await parentUid(plan.parent, made.current) }
              : { list: TRAINING_LIST })
          })
          setTask(sub.uid)
        } else {
          const left = tasks.find((t) => t.uid === plan.uid)?.parentUid ?? null
          await window.api.tasks.updateForSession(plan.uid, {
            ...(plan.title !== undefined ? { title: plan.title } : {}),
            ...(plan.due !== undefined ? { due: plan.due } : {}),
            ...(plan.parent
              ? { parentUid: await parentUid(plan.parent, made.current) }
              : plan.parent === null
                ? { parentUid: null, list: TRAINING_LIST }
                : {})
          })
          if (plan.parent !== undefined) {
            const stranded = strandedParent(
              made.current,
              left,
              await window.api.tasks.list('research')
            )
            if (stranded) await window.api.tasks.deleteForSession(stranded)
          }
        }
      } catch (error) {
        console.error('Could not keep the training task in step:', error)
      } finally {
        busy.current = false
      }
    }
    // The series and the title are typed letter by letter: nothing is made or moved until they settle.
    const timer = setTimeout(() => void run(), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [ready, tasks, task, series, title, date, setTask])

  return { tasks }
}
