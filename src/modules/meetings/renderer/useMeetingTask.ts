import { useEffect, useRef } from 'react'
import { useTasksList } from '../../tasks/renderer/useTasksList'
import { useWorkClients } from '../../tasks/renderer/useWorkClients'
import type { Task } from '../../tasks/shared/types'
import { planMeetingTask, type MeetingParent } from '../shared/meeting-task'
import type { MeetingMeta, MeetingWorkspace } from '../shared/types'

/** How long the series or date stays still before the subtask follows it. */
const SETTLE_MS = 800

async function parentUid(workspace: MeetingWorkspace, target: MeetingParent): Promise<string> {
  if ('uid' in target) return target.uid
  const task = await window.api.tasks.create({
    workspace,
    title: target.title,
    list: target.list
  })
  return task.uid
}

/**
 * Keeps a meeting note's task in step, with no clicking. A meeting made in the app starts marked `auto`; once it has a date and its
 * series names a task, its own subtask is made under that series task (found, or made). After that the subtask follows the note.
 * An older note, or a task the user chose, is never touched. What to do is `planMeetingTask`; this only does it, one thing at a time.
 */
export function useMeetingTask(
  workspace: MeetingWorkspace,
  meta: MeetingMeta,
  ready: boolean,
  setTask: (uid: string) => void
): { tasks: Task[] | null } {
  const { tasks } = useTasksList(workspace)
  const clients = useWorkClients(workspace)
  const busy = useRef(false)
  const { task, series, date } = meta

  useEffect(() => {
    if (!ready || tasks === null || busy.current) return
    const plan = planMeetingTask(workspace, { task, series, date }, clients, tasks)
    if (plan.kind === 'none') return
    const run = async (): Promise<void> => {
      busy.current = true
      try {
        if (plan.kind === 'create') {
          const sub = await window.api.tasks.create({
            workspace,
            title: plan.title,
            status: 'doing',
            parentUid: await parentUid(workspace, plan.parent)
          })
          setTask(sub.uid)
        } else {
          await window.api.tasks.update(plan.uid, {
            ...(plan.title !== undefined ? { title: plan.title } : {}),
            ...(plan.parent ? { parentUid: await parentUid(workspace, plan.parent) } : {})
          })
        }
      } catch (error) {
        console.error('Could not keep the meeting task in step:', error)
      } finally {
        busy.current = false
      }
    }
    const timer = setTimeout(() => void run(), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [ready, tasks, clients, workspace, task, series, date, setTask])

  return { tasks }
}
