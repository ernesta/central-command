import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { matchesShortcut } from '@shared/shortcuts'
import { NEW_TASK_SHORTCUT } from '../shared/shortcuts'
import { closeNewTask, openNewTask, useNewTaskRequest } from './new-task-store'
import { NewTaskDialog } from './NewTaskDialog'
import { clearTaskToast, useTaskToast } from './task-toast'
import { todayIso, useTasksWorkspace } from './tasks-paths'
import { useTasksList } from './useTasksList'
import styles from './TaskGlobals.module.css'

/**
 * What must work anywhere in the app: the shortcut that starts a task, the one New task dialog, and the short message
 * ("Done. The next one is due …"). Renders nothing in place.
 */
export function TaskGlobals(): React.JSX.Element {
  const request = useNewTaskRequest()
  const toast = useTaskToast()
  const { search } = useLocation()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesShortcut(event, NEW_TASK_SHORTCUT)) return
      event.preventDefault()
      if (event.repeat) return
      // On a list's page the task starts in that list.
      openNewTask({ list: new URLSearchParams(search).get('list') ?? undefined })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [search])

  return (
    <>
      {request && <NewTaskHost list={request.list ?? ''} />}
      {toast && (
        <div className={styles.toast} role="status">
          {toast.text}
          {toast.action && (
            <button
              type="button"
              className={styles.toastAction}
              onClick={() => {
                toast.action?.run()
                clearTaskToast()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </>
  )
}

/** Loads the workspace's tasks (for the lists to choose from) only while the dialog is open. */
function NewTaskHost({ list }: { list: string }): React.JSX.Element | null {
  const workspace = useTasksWorkspace()
  const { rows } = useTasksList(workspace)
  if (rows === null) return null
  return (
    <NewTaskDialog
      workspace={workspace}
      rows={rows}
      today={todayIso()}
      listFilter={list}
      onClose={closeNewTask}
    />
  )
}
