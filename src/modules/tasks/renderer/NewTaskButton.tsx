import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { openNewTask } from './new-task-store'

/** "New task": opens the dialog (also available from anywhere with the shortcut). */
export function NewTaskButton({ list }: { list?: string }): React.JSX.Element {
  return (
    <Button
      variant="primary"
      icon={<Plus size={14} strokeWidth={2} aria-hidden />}
      onClick={() => openNewTask({ list })}
    >
      New task
    </Button>
  )
}
