import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { isUntouchedBody } from '@renderer/components/untouched'
import { NEW_TRAINING_BODY } from '../shared/front-matter'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { pushUndoWithToast } from '@renderer/components/undo-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { DocSplit } from '@renderer/notes/DocSplit'
import { EditorCard } from '@renderer/notes/EditorCard'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import { NoteOutline } from '@renderer/notes/NoteOutline'
import type { Person } from '@shared/people'
import { DeleteTimeDialog } from '@renderer/components/DeleteTimeDialog'
import { formatDate } from '@shared/time'
import { durationMinutes } from '../../meetings/shared/time'
import { deletedMessage, timeOnTasks } from '../../tasks/renderer/task-actions'
import { institutionOptions, seriesOptions } from '../shared/rules'
import type { TrainingRef } from '../shared/types'
import { trainingLabel, trainingTaskUid } from '../shared/training-entries'
import { MeetingHoursNote } from '../../meetings/renderer/MeetingHoursNote'
import { FilesPanel } from './FilesPanel'
import { TrainingHours } from './TrainingHours'
import { TrainingTask } from './TrainingTask'
import { taskRoute } from '../../tasks/renderer/tasks-paths'
import { entryRoute, trainingBase, useTrainingWorkspace } from './training-paths'
import { TrainingMetaFields } from './TrainingMetaFields'
import { useTrainingTask } from './useTrainingTask'
import { useSelfStudyTask } from './useSelfStudyTask'
import { useTrainingSession } from './useTrainingSession'
import styles from './TrainingEntryPage.module.css'

/** One training entry: its details and its note (Summary and Notes). */
export function TrainingEntryPage(): React.JSX.Element {
  const { id = '' } = useParams()
  const workspace = useTrainingWorkspace()
  const navigate = useNavigate()
  // Changing the date or title renames the file, and so changes the id in the address. The page keeps
  // its state (and the cursor) by staying mounted under the id it opened with: `ids` are the names this
  // entry has had, so the address moving from one to the next does not remount it.
  const [known, setKnown] = useState<{ key: string; ids: string[] }>({ key: id, ids: [id] })
  const key = known.ids.includes(id) ? known.key : id
  return (
    <EntryView
      key={key}
      entryRef={{ workspace, id: key }}
      currentId={id}
      names={known.ids}
      onRenamed={(newId) => {
        setKnown((prev) =>
          prev.key === key ? { key, ids: [...prev.ids, newId] } : { key, ids: [key, newId] }
        )
        void navigate(entryRoute(newId, workspace), { replace: true })
      }}
    />
  )
}

function EntryView({
  entryRef,
  currentId,
  names,
  onRenamed
}: {
  entryRef: TrainingRef
  /** The id in the address now: the page stays mounted under the id it opened with, but a rename changes the file's. */
  currentId: string
  /** Every name this entry has had since the page opened. */
  names: readonly string[]
  onRenamed: (id: string) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { workspace } = entryRef
  // Life has no training task (an hours subtask in Tasks), no type and no skills.
  const research = workspace === 'research'
  const { session, snapshot } = useTrainingSession(entryRef, onRenamed)
  const [people, setPeople] = useState<Person[]>([])
  const [seriesUsed, setSeriesUsed] = useState<string[]>([])
  const [institutionsUsed, setInstitutionsUsed] = useState<string[]>([])
  const titleRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const focusTitle = useRef((location.state as { isNew?: boolean } | null)?.isNew === true)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.meetings.people.list().then((list) => {
      if (!cancelled) setPeople(list)
    })
    void window.api.training.list(workspace).then((rows) => {
      if (cancelled) return
      setSeriesUsed(seriesOptions(rows))
      setInstitutionsUsed(institutionOptions(rows))
    })
    return () => {
      cancelled = true
    }
  }, [workspace])

  // A brand-new entry opens with its title selected, so typing replaces "Untitled".
  const ready = snapshot.status === 'ready'
  useEffect(() => {
    if (!ready || !focusTitle.current) return
    focusTitle.current = false
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [ready])

  const { meta, body, save, error, conflict, reloadedFromDisk, problems, updatedAt } = snapshot
  const { tasks } = useTrainingTask(meta, ready, (task) => session.setMeta({ task }))
  const { ensure } = useSelfStudyTask(meta, ready, tasks, (selfStudyTask) =>
    session.setMeta({ selfStudy: selfStudyTask })
  )
  const trainingUid = trainingTaskUid(meta.task)
  const trainingTask = trainingUid ? tasks?.find((t) => t.uid === trainingUid) : undefined
  useDocumentTitle(meta.title)

  // Back goes to wherever the user came from (the list); with no history, the list.

  const addPerson = useCallback(async (name: string): Promise<Person> => {
    const list = await window.api.meetings.people.add({ name })
    setPeople(list)
    const added = list.find(
      (p) => p.name.toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase()
    )
    if (!added) throw new Error('Couldn’t add that person')
    return added
  }, [])

  // A page nothing was typed into goes without asking.
  const untouched =
    (!meta.title || meta.title === 'Untitled') && isUntouchedBody(body, NEW_TRAINING_BODY)

  // What deleting takes out of Hours: the note's own session and the time tracked on its two tasks.
  const timeLeaving = async (): Promise<number> =>
    (trainingUid ? (durationMinutes(meta.start, meta.end) ?? 0) : 0) +
    (await timeOnTasks([trainingUid, meta.selfStudy]))
  const [ask, setAsk] = useState<number | null>(null)

  const removeNote = async (confirmed = false): Promise<void> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const minutes = await timeLeaving()
      // A training with time asks first: the time leaves Hours with it.
      if (!confirmed && minutes > 0) {
        setAsk(minutes)
        setDeleting(false)
        return
      }
      await session.dispose() // saves anything pending first; an entry nothing was written in is removed by it
      if (session.wasDiscarded()) {
        void navigate(trainingBase(workspace), { replace: true })
        return
      }
      const ref = session.getRef()
      const content = await window.api.training.delete(ref)
      // The training's tasks go with it (to the Tasks trash; the series' self-study task stays); the time tracked on them goes with them and Undo brings it back.
      const trashedTasks: string[] = []
      for (const uid of [trainingUid, meta.selfStudy]) {
        if (!uid) continue
        try {
          await window.api.tasks.deleteForSession(uid)
          trashedTasks.push(uid)
        } catch (e) {
          console.error('Could not delete the training task:', e)
        }
      }
      if (!untouched || minutes > 0) {
        pushUndoWithToast(deletedMessage(heading, minutes), {
          label: `deletion of “${heading}”`,
          undo: async () => {
            await window.api.training.restore(ref, content)
            for (const uid of trashedTasks) await window.api.tasks.restore(uid)
          }
        })
      }
      void navigate(trainingBase(workspace), { replace: true })
    } catch (e) {
      setDeleteError(ipcErrorMessage(e))
      setDeleting(false)
      void session.start()
    }
  }

  if (snapshot.status === 'loading') return <div className={styles.page} />
  if (snapshot.status === 'missing') {
    return (
      <div className={styles.page}>
        <EmptyState
          heading="Training entry not found"
          message={`There is no training entry “${entryRef.id}”. It may have been moved or deleted.`}
        />
      </div>
    )
  }

  const heading = `${trainingLabel(meta.series, meta.title || 'Untitled')} · ${meta.date ? formatDate(meta.date) : 'No date'}`

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <input
          ref={titleRef}
          className={styles.title}
          aria-label="Title"
          placeholder="Title"
          value={meta.title}
          onChange={(event) =>
            session.setMeta({ title: event.target.value.replace(/[\r\n]/g, ' ') })
          }
        />
        <div className={styles.actions}>
          <Button
            size="small"
            variant="danger-outline"
            disabled={deleting}
            onClick={() => void removeNote()}
          >
            Delete entry
          </Button>
          {ask !== null && (
            <DeleteTimeDialog
              title={heading}
              minutes={ask}
              busy={deleting}
              onCancel={() => setAsk(null)}
              onConfirm={() => {
                setAsk(null)
                void removeNote(true)
              }}
            />
          )}
        </div>
      </div>

      {(conflict || error || deleteError || problems.length > 0) && (
        <div className={styles.notices}>
          {conflict && (
            <Notice
              action={
                <span className={styles.noticeActions}>
                  <Button size="small" onClick={() => void session.keepMine()}>
                    Keep my version
                  </Button>
                  <Button size="small" onClick={() => void session.useDisk()}>
                    Use the file’s version
                  </Button>
                </span>
              }
            >
              This entry was changed outside the app while you were editing. Nothing has been
              overwritten.
            </Notice>
          )}
          {error && (
            <Notice
              tone="error"
              action={
                <Button size="small" onClick={() => void session.flush()}>
                  Try again
                </Button>
              }
            >
              Couldn’t save this entry: {error}
            </Notice>
          )}
          {deleteError && (
            <Notice tone="error" onDismiss={() => setDeleteError(null)}>
              Couldn’t move the entry to the Trash: {deleteError}
            </Notice>
          )}
          {problems.length > 0 && (
            <Notice>
              This file’s details need a look: {problems.join('; ')}. Nothing has been changed.
            </Notice>
          )}
        </div>
      )}

      <TrainingMetaFields
        meta={meta}
        people={people}
        seriesSuggestions={seriesUsed}
        institutionSuggestions={institutionsUsed}
        onChange={(patch) => session.setMetaUndoable(patch)}
        onAddPerson={addPerson}
        workspace={workspace}
        trainingTaskTo={
          research && trainingTask ? taskRoute(trainingTask.workspace, trainingTask.uid) : undefined
        }
      />

      <MeetingHoursNote
        workspace={workspace}
        id={currentId}
        meta={meta}
        kind="training"
        show="clashes"
        renamedFrom={names}
      />

      {research && meta.task && (
        <TrainingTask
          task={meta.task}
          series={meta.series}
          tasks={tasks}
          onRemake={() => session.setMeta({ task: 'auto' })}
          selfStudy={tasks?.find((t) => t.uid === meta.selfStudy)}
        >
          <TrainingHours meta={meta} tasks={tasks} ensure={ensure} />
        </TrainingTask>
      )}

      <DocSplit
        docRef={docRef}
        fullWidth
        side={
          <>
            <NoteOutline text={body} docRef={docRef} />
            <FilesPanel
              folder={meta.folder}
              onChange={(folder) => session.setMetaUndoable({ folder })}
            />
          </>
        }
      >
        <EditorCard text={body} edited={updatedAt} save={save} reloaded={reloadedFromDisk}>
          <LiveEditor
            key={snapshot.editorKey}
            initial={snapshot.initialBody}
            placeholder="Write your notes…"
            showPlaceholder={body.trim() === ''}
            onChange={session.editBody.bind(session)}
            onBlur={() => void session.flush()}
          />
        </EditorCard>
      </DocSplit>
    </div>
  )
}
