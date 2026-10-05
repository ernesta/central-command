import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { tasksBase, useTasksWorkspace } from './tasks-paths'
import { useTasksList } from './useTasksList'

/** One task's page. Stage 4 builds it; until then it names the task. */
export function TaskPage(): React.JSX.Element {
  const workspace = useTasksWorkspace()
  const { uid = '' } = useParams()
  const { tasks } = useTasksList(workspace)
  const task = tasks?.find((t) => t.uid === uid)
  return (
    <div style={{ padding: '36px 48px', display: 'grid', gap: 16 }}>
      <Link to={tasksBase(workspace)}>
        <ArrowLeft size={14} aria-hidden /> Tasks
      </Link>
      <h1>{task?.title ?? ''}</h1>
    </div>
  )
}
