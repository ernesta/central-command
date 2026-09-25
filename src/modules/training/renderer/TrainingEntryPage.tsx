import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { DeleteDialog } from '@renderer/components/DeleteDialog'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { NotesEditor } from '@renderer/notes/NotesEditor'
import type { SaveState } from '@renderer/notes/notes-session'
import type { Person } from '@shared/people'
import { formatDate } from '@shared/time'
import { seriesOptions } from '../shared/rules'
import { TRAINING_SERIES, type TrainingRef } from '../shared/types'
import { FilesPanel } from './FilesPanel'
import { entryRoute, trainingBase } from './training-paths'
import { TrainingMetaFields } from './TrainingMetaFields'
import { useTrainingSession } from './useTrainingSession'
import styles from './TrainingEntryPage.module.css'

function statusText(save: SaveState, reloaded: boolean): string {
  switch (save) {
    case 'saving':
      return 'Saving…'
    case 'dirty':
      return 'Unsaved changes'
    case 'error':
      return 'Couldn’t save'
    case 'clean':
      return reloaded ? 'Updated from an outside change' : 'Saved'
  }
}

/** One training entry: its details and its note (Summary and Notes). */
export function TrainingEntryPage(): React.JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // Changing the date or title renames the file, and so changes the id in the address. The page keeps
  // its state (and the cursor) by staying mounted under the id it opened with: `ids` are the names this
  // entry has had, so the address moving from one to the next does not remount it.
  const [known, setKnown] = useState<{ key: string; ids: string[] }>({ key: id, ids: [id] })
  const key = known.ids.includes(id) ? known.key : id
  return (
    <EntryView
      key={key}
      entryRef={{ workspace: 'research', id: key }}
      onRenamed={(newId) => {
        setKnown((prev) =>
          prev.key === key ? { key, ids: [...prev.ids, newId] } : { key, ids: [key, newId] }
        )
        void navigate(entryRoute(newId), { replace: true })
      }}
    />
  )
}

function EntryView({
  entryRef,
  onRenamed
}: {
  entryRef: TrainingRef
  onRenamed: (id: string) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, snapshot } = useTrainingSession(entryRef, onRenamed)
  const [people, setPeople] = useState<Person[]>([])
  const [seriesUsed, setSeriesUsed] = useState<string[]>([...TRAINING_SERIES])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTitle = useRef((location.state as { isNew?: boolean } | null)?.isNew === true)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.meetings.people.list().then((list) => {
      if (!cancelled) setPeople(list)
    })
    void window.api.training.list('research').then((rows) => {
      if (!cancelled) setSeriesUsed(seriesOptions(rows, TRAINING_SERIES))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // A brand-new entry opens with its title selected, so typing replaces "Untitled".
  const ready = snapshot.status === 'ready'
  useEffect(() => {
    if (!ready || !focusTitle.current) return
    focusTitle.current = false
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [ready])

  const { meta, body, save, error, conflict, reloadedFromDisk, problems } = snapshot

  // Back goes to wherever the user came from (the list); with no history, the list.
  const goBack = (): void =>
    void (location.key !== 'default' ? navigate(-1) : navigate(trainingBase))

  const addPerson = useCallback(async (name: string): Promise<Person> => {
    const list = await window.api.meetings.people.add({ name })
    setPeople(list)
    const added = list.find(
      (p) => p.name.toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase()
    )
    if (!added) throw new Error('Could not add that person')
    return added
  }, [])

  const confirmAndDelete = async (): Promise<void> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await session.dispose() // saves anything pending first
      await window.api.training.delete(session.getRef())
      void navigate(trainingBase)
    } catch (e) {
      setDeleteError(ipcErrorMessage(e))
      setDeleting(false)
      setConfirmDelete(false)
      void session.start()
    }
  }

  const back = (
    <button type="button" className={styles.back} onClick={goBack}>
      <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
      Training
    </button>
  )

  if (snapshot.status === 'loading') return <div className={styles.page} />
  if (snapshot.status === 'missing') {
    return (
      <div className={styles.page}>
        {back}
        <EmptyState
          heading="Training entry not found"
          message={`There is no training entry “${entryRef.id}”. It may have been moved or deleted.`}
        />
      </div>
    )
  }

  const heading = [meta.title || 'Untitled', meta.date ? formatDate(meta.date) : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={styles.page}>
      {back}
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
          <span
            className={[styles.status, save === 'error' && styles.statusError]
              .filter(Boolean)
              .join(' ')}
            role="status"
          >
            {statusText(save, reloadedFromDisk)}
          </span>
          <Button size="small" className={styles.delete} onClick={() => setConfirmDelete(true)}>
            Delete entry
          </Button>
        </div>
      </div>

      {(conflict || error || deleteError || meta.review || problems.length > 0) && (
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
          {meta.review && (
            <Notice
              action={
                <Button size="small" onClick={() => session.setMeta({ review: null })}>
                  Done
                </Button>
              }
            >
              To review: {meta.review}
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
        onChange={(patch) => session.setMeta(patch)}
        onAddPerson={addPerson}
      />

      <FilesPanel folder={meta.folder} onChange={(folder) => session.setMeta({ folder })} />

      <div className={styles.doc}>
        <NotesEditor
          key={snapshot.editorKey}
          initial={snapshot.initialBody}
          placeholder="Write your notes…"
          showPlaceholder={body.trim() === ''}
          onChange={session.editBody.bind(session)}
          onBlur={() => void session.flush()}
        />
      </div>

      <DeleteDialog
        open={confirmDelete}
        heading={heading}
        noun="training entry"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmAndDelete()}
      />
    </div>
  )
}
