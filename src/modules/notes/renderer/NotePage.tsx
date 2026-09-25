import { ArrowLeft, Pin } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { DeleteDialog } from '@renderer/components/DeleteDialog'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { NotesEditor } from '@renderer/notes/NotesEditor'
import type { SaveState } from '@renderer/notes/notes-session'
import { markdownToExcerpt } from '@shared/text'
import { formatDate } from '@shared/time'
import { isoDate } from '../shared/dates'
import { deriveGroups } from '../shared/groups'
import { canPin } from '../shared/pinning'
import { UNTITLED } from '../shared/query'
import type { NoteRef } from '../shared/types'
import { GroupField } from './GroupField'
import { noteRoute, notesBase } from './notes-paths'
import { useNoteSession } from './useNoteSession'
import { useNotesList } from './useNotesList'
import styles from './NotePage.module.css'

/** Where the cursor starts in a note that was just made: the title (New note) or the text (quick capture). */
export interface NoteLocationState {
  focus?: 'title' | 'body'
}

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

/** One note: its title, group and pin above the text. */
export function NotePage(): React.JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Changing the title renames the file, and so changes the id in the address. The page keeps its state
  // (and the cursor) by staying mounted under the id it opened with: `ids` are the names this note has
  // had, so the address moving from one to the next does not remount it.
  const [known, setKnown] = useState<{ key: string; ids: string[] }>({ key: id, ids: [id] })
  const key = known.ids.includes(id) ? known.key : id
  return (
    <NoteView
      key={key}
      noteRef={{ workspace: 'research', id: key }}
      onRenamed={(newId) => {
        setKnown((prev) =>
          prev.key === key ? { key, ids: [...prev.ids, newId] } : { key, ids: [key, newId] }
        )
        void navigate(noteRoute(newId), { replace: true, state: location.state })
      }}
    />
  )
}

function NoteView({
  noteRef,
  onRenamed
}: {
  noteRef: NoteRef
  onRenamed: (id: string) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, snapshot } = useNoteSession(noteRef, onRenamed)
  const rows = useNotesList()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [startFocus] = useState(() => (location.state as NoteLocationState | null)?.focus ?? null)
  const titleFocused = useRef(false)

  const groups = useMemo(() => deriveGroups(rows ?? []), [rows])

  // A brand-new note opens with the cursor where the way it was made says (see `NoteLocationState`).
  const ready = snapshot.status === 'ready'
  useEffect(() => {
    if (!ready || startFocus !== 'title' || titleFocused.current) return
    titleFocused.current = true
    titleRef.current?.focus()
  }, [ready, startFocus])

  const { meta, body, save, error, conflict, reloadedFromDisk, problems, updatedAt } = snapshot

  // Back goes to wherever the user came from (the landing page or a list); with no history, the landing page.
  const goBack = (): void => void (location.key !== 'default' ? navigate(-1) : navigate(notesBase))

  const confirmAndDelete = async (): Promise<void> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await session.dispose() // saves anything pending first
      await window.api.notes.delete(session.getRef())
      void navigate(notesBase)
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
      Notes
    </button>
  )

  if (snapshot.status === 'loading') return <div className={styles.page} />
  if (snapshot.status === 'missing') {
    return (
      <div className={styles.page}>
        {back}
        <EmptyState
          heading="Note not found"
          message={`There is no note “${noteRef.id}”. It may have been moved or deleted.`}
        />
      </div>
    )
  }

  const heading = meta.title || markdownToExcerpt(body, 40) || UNTITLED
  const pinDisabled = !meta.pinned && rows !== null && !canPin(rows, session.getRef().id)

  return (
    <div className={styles.page}>
      {back}
      <div className={styles.head}>
        <input
          ref={titleRef}
          className={styles.title}
          aria-label="Title"
          placeholder={UNTITLED}
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
            Delete note
          </Button>
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
              This note was changed outside the app while you were editing. Nothing has been
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
              Couldn’t save this note: {error}
            </Notice>
          )}
          {deleteError && (
            <Notice tone="error" onDismiss={() => setDeleteError(null)}>
              Couldn’t move the note to the Trash: {deleteError}
            </Notice>
          )}
          {problems.length > 0 && (
            <Notice>
              This file’s details need a look: {problems.join('; ')}. Nothing has been changed.
            </Notice>
          )}
        </div>
      )}

      <div className={styles.meta}>
        <div className={styles.field}>
          <span className={styles.label}>Group</span>
          <GroupField
            group={meta.group}
            subgroup={meta.subgroup}
            groups={groups}
            onChange={(value) => session.setMeta(value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Created</span>
          <span className={styles.value}>{meta.created ? formatDate(meta.created) : '—'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Updated</span>
          <span className={styles.value}>
            {updatedAt === null ? '—' : formatDate(isoDate(updatedAt))}
          </span>
        </div>
        <Button
          size="small"
          className={styles.pin}
          aria-pressed={meta.pinned}
          disabled={pinDisabled}
          title={pinDisabled ? 'Four notes are pinned. Unpin one first.' : undefined}
          icon={
            <Pin
              size={14}
              strokeWidth={1.75}
              fill={meta.pinned ? 'currentColor' : 'none'}
              aria-hidden
            />
          }
          onClick={() => session.setMeta({ pinned: !meta.pinned })}
        >
          {meta.pinned ? 'Pinned' : 'Pin'}
        </Button>
      </div>

      <div className={styles.doc}>
        <NotesEditor
          key={snapshot.editorKey}
          initial={snapshot.initialBody}
          placeholder="Write your note…"
          showPlaceholder={body.trim() === ''}
          // Only the first editor: a later one (the file changed outside) must not take the cursor.
          autoFocus={startFocus === 'body' && snapshot.editorKey === 1}
          onChange={session.editBody.bind(session)}
          onBlur={() => void session.flush()}
        />
      </div>

      <DeleteDialog
        open={confirmDelete}
        heading={heading}
        noun="note"
        contents="text"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmAndDelete()}
      />
    </div>
  )
}
