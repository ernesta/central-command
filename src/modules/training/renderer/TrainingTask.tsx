import { ListChecks } from 'lucide-react'
import { useNavigate } from 'react-router'
import { IconButton } from '@renderer/components/IconButton'
import { Panel } from '@renderer/components/Panel'
import { taskRoute } from '../../tasks/renderer/tasks-paths'
import type { Task } from '../../tasks/shared/types'

/**
 * The training's self-study tracking: a "Self-study" card with the hours, Start and Add time, and an icon that opens the self-study task
 * once it exists (made when Start or Add time is first pressed). The training's own task (the session) is made and kept in step
 * automatically by `useTrainingTask` and is never shown (28 Oct 2026): there is no panel for it, and a deleted one is not made again.
 */
export function TrainingTask({
  tasks,
  selfStudy,
  children
}: {
  tasks: readonly Task[] | null
  /** The training's self-study task, once it exists. */
  selfStudy?: Task
  /** The training's hours. */
  children?: React.ReactNode
}): React.JSX.Element | null {
  const navigate = useNavigate()
  if (tasks === null) return null
  return (
    <Panel
      label="Self-study"
      row
      actions={
        selfStudy && (
          <IconButton
            label="Open self-study task"
            onClick={() => void navigate(taskRoute(selfStudy.workspace, selfStudy.uid))}
          >
            <ListChecks size={16} strokeWidth={1.75} aria-hidden />
          </IconButton>
        )
      }
    >
      {children}
    </Panel>
  )
}
