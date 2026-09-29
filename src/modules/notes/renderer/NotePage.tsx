import { ArrowLeft, Pin } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { DeleteDialog } from '@renderer/components/DeleteDialog'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { EditorCard } from '@renderer/notes/EditorCard'
import { NotesEditor } from '@renderer/notes/NotesEditor'
import { markdownToExcerpt } from '@shared/text'
import { deriveGroups } from '../shared/groups'
import { canPin } from '../shared/pinning'
import { UNTITLED } from '../shared/query'
import type { NoteRef, NoteWorkspace } from '../shared/types'
import { GroupField } from './GroupField'
import { MentionedIn } from '@renderer/entities/MentionedIn'
import { NoteOutline } from './NoteOutline'
import { WorkspaceSelect, type MovableWorkspace } from '@renderer/components/WorkspaceSelect'
import { noteRoute, notesBase, useNotesWorkspace } from './notes-paths'
import { useNoteSession } from './useNoteSession'
import { useNotesList } from './useNotesList'
import styles from './NotePage.module.css'

/** Where the cursor starts in a note that was just made: the title (New note) or the text (quick capture). */
export interface NoteLocationState {
  focus?: 'title' | 'body'
}

/** One note: its title, group and pin above the text. */
export function NotePage(): React.JSX.Element {
  // A move to the other workspace starts the page afresh: the names the note had in the first one mean nothing in the second.
  const workspace = useNotesWorkspace()
  return <NotePageIn key={workspace} workspace={workspace} />
}

function NotePageIn({ workspace }: { workspace: NoteWorkspace }): React.JSX.Element {
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
      key={`${workspace}/${key}`}
      noteRef={{ workspace, id: key }}
      onRenamed={(newId) => {
        setKnown((prev) =>
          prev.key === key ? { key, ids: [...prev.ids, newId] } : { key, ids: [key, newId] }
        )
        void navigate(noteRoute(workspace, newId), { replace: true, state: location.state })
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
  const rows = useNotesList(noteRef.workspace)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
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
  useDocumentTitle(meta.title)

  // Back goes to wherever the user came from (the landing page or a list); with no history, the landing page.
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const moveTo = async (target: MovableWorkspace): Promise<void> => {
    setMoving(true)
    setMoveError(null)
    try {
      await session.dispose() // saves anything pending first
      const moved = await window.api.notes.move(session.getRef(), target)
      void navigate(noteRoute(moved.ref.workspace, moved.ref.id), { replace: true })
    } catch (e) {
      setMoveError(ipcErrorMessage(e))
      setMoving(false)
      void session.start()
    }
  }

  const goBack = (): void =>
    void (location.key !== 'default' ? navigate(-1) : navigate(notesBase(noteRef.workspace)))

  const confirmAndDelete = async (): Promise<void> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await session.dispose() // saves anything pending first
      await window.api.notes.delete(session.getRef())
      void navigate(notesBase(noteRef.workspace))
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
          <WorkspaceSelect
            value={noteRef.workspace}
            disabled={moving}
            onChange={(target) => void moveTo(target)}
          />
          <GroupField
            group={meta.group}
            subgroup={meta.subgroup}
            groups={groups}
            onChange={(value) => session.setMeta(value)}
          />
          <Button
            size="small"
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
          <Button size="small" className={styles.delete} onClick={() => setConfirmDelete(true)}>
            Delete note
          </Button>
        </div>
      </div>

      {(conflict || error || deleteError || moveError || problems.length > 0) && (
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
          {moveError && (
            <Notice tone="error" onDismiss={() => setMoveError(null)}>
              Couldn’t move the note: {moveError}
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

      <div className={styles.split}>
        <div className={styles.doc} ref={docRef}>
          <EditorCard text={body} edited={updatedAt} save={save} reloaded={reloadedFromDisk}>
            {(findSetup) => (
              <NotesEditor
                key={snapshot.editorKey}
                initial={snapshot.initialBody}
                placeholder="Write your note…"
                showPlaceholder={body.trim() === ''}
                // Not after the file changed outside: that editor must not take the cursor.
                autoFocus={startFocus === 'body' && !reloadedFromDisk}
                findSetup={findSetup}
                entitySelf={{ kind: 'note', workspace: noteRef.workspace, id: session.getRef().id }}
                onChange={session.editBody.bind(session)}
                onBlur={() => void session.flush()}
              />
            )}
          </EditorCard>
        </div>
        <div className={styles.side}>
          <NoteOutline text={body} docRef={docRef} />
          <MentionedIn
            kind="note"
            entityKey={rows?.find((r) => r.id === session.getRef().id)?.uid || null}
          />
        </div>
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
