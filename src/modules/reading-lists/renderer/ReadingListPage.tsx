import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { DeleteDialog } from '@renderer/components/DeleteDialog'
import { isUntouchedBody } from '@renderer/components/untouched'
import { NEW_LIST_BODY } from '../shared/front-matter'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { EditorCard } from '@renderer/notes/EditorCard'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import type { ReadingListRef } from '@modules/reading-lists/shared/types'
import { readingListRoute, readingListsBase } from './reading-lists-paths'
import { useListSession } from './useListSession'
import styles from './ReadingListPage.module.css'

/** One reading list: its title, and its sections and entries as a Markdown note; a paper is a reading mention. */
export function ReadingListPage(): React.JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // Changing the title renames the file, and so changes the id in the address. The page keeps its
  // state (and the cursor) by staying mounted under the id it opened with, the same as every other
  // entry page in the app.
  const [known, setKnown] = useState<{ key: string; ids: string[] }>({ key: id, ids: [id] })
  const key = known.ids.includes(id) ? known.key : id
  return (
    <ListView
      key={key}
      listRef={{ workspace: 'research', id: key }}
      onRenamed={(newId) => {
        setKnown((prev) =>
          prev.key === key ? { key, ids: [...prev.ids, newId] } : { key, ids: [key, newId] }
        )
        void navigate(readingListRoute(newId), { replace: true })
      }}
    />
  )
}

function ListView({
  listRef,
  onRenamed
}: {
  listRef: ReadingListRef
  onRenamed: (id: string) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, snapshot } = useListSession(listRef, onRenamed)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTitle = useRef((location.state as { isNew?: boolean } | null)?.isNew === true)

  const { meta, body, save, error, conflict, reloadedFromDisk, updatedAt } = snapshot
  useDocumentTitle(meta.title || 'Untitled list')

  // A brand-new list opens with its title selected, so typing replaces "Untitled list".
  const ready = snapshot.status === 'ready'
  useEffect(() => {
    if (!ready || !focusTitle.current) return
    focusTitle.current = false
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [ready])

  const goBack = (): void =>
    void (location.key !== 'default' ? navigate(-1) : navigate(readingListsBase))

  // A page nothing was typed into goes without asking.
  const untouched = !meta.title && isUntouchedBody(body, NEW_LIST_BODY)

  const confirmAndDelete = async (): Promise<void> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await session.dispose()
      await window.api.readingLists.delete(session.getRef())
      void navigate(readingListsBase)
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
      Reading lists
    </button>
  )

  if (snapshot.status === 'loading') return <div className={styles.page} />
  if (snapshot.status === 'missing') {
    return (
      <div className={styles.page}>
        {back}
        <EmptyState
          heading="Reading list not found"
          message={`There is no reading list “${listRef.id}”. It may have been moved or deleted.`}
        />
      </div>
    )
  }

  const heading = meta.title || 'Untitled list'

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
          <Button
            size="small"
            variant="danger-outline"
            onClick={() => (untouched ? void confirmAndDelete() : setConfirmDelete(true))}
          >
            Delete list
          </Button>
        </div>
      </div>

      {(conflict || error || deleteError) && (
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
              This list was changed outside the app while you were editing. Nothing has been
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
              Couldn’t save this list: {error}
            </Notice>
          )}
          {deleteError && (
            <Notice tone="error" onDismiss={() => setDeleteError(null)}>
              Couldn’t move the list to the Trash: {deleteError}
            </Notice>
          )}
        </div>
      )}

      <div className={styles.doc}>
        <EditorCard text={body} edited={updatedAt} save={save} reloaded={reloadedFromDisk}>
          <LiveEditor
            key={snapshot.editorKey}
            initial={snapshot.initialBody}
            placeholder="Write a section as a heading, then each paper as a bullet: type @ to mention a reading, then an annotation."
            showPlaceholder={body.trim() === ''}
            onChange={session.editBody.bind(session)}
            onBlur={() => void session.flush()}
          />
        </EditorCard>
      </div>

      <DeleteDialog
        open={confirmDelete}
        heading={heading}
        noun="reading list"
        contents="entries"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmAndDelete()}
      />
    </div>
  )
}
