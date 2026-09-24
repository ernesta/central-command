import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { NotesEditor } from '@renderer/notes/NotesEditor'
import type { SaveState } from '@renderer/notes/notes-session'
import { ownerOptions } from '../shared/people'
import { meetingHeading } from '../shared/time'
import { appendTopic, parseTopics, type Topic } from '../shared/topics'
import type { MeetingRef, Person } from '../shared/types'
import { DeleteDialog } from './DeleteDialog'
import { meetingRoute, meetingsBase } from './meetings-paths'
import { MetaFields } from './MetaFields'
import { TopicsPanel } from './TopicsPanel'
import { useMeetingSession } from './useMeetingSession'
import { useTodoHelper } from './useTodoHelper'
import styles from './MeetingPage.module.css'

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

/** One meeting: its details, its note (Summary, Previous TODOs, Notes) and the topics panel. */
export function MeetingPage(): React.JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // Changing the date or series renames the file, and so changes the id in the address. The page keeps
  // its state (and the cursor) by staying mounted under the id it opened with: `ids` are the names this
  // meeting has had, so the address moving from one to the next does not remount it.
  const [known, setKnown] = useState<{ key: string; ids: string[] }>({ key: id, ids: [id] })
  const key = known.ids.includes(id) ? known.key : id
  return (
    <MeetingView
      key={key}
      meetingRef={{ workspace: 'research', id: key }}
      onRenamed={(newId) => {
        setKnown((prev) =>
          prev.key === key ? { key, ids: [...prev.ids, newId] } : { key, ids: [key, newId] }
        )
        void navigate(meetingRoute(newId), { replace: true })
      }}
    />
  )
}

function MeetingView({
  meetingRef,
  onRenamed
}: {
  meetingRef: MeetingRef
  onRenamed: (id: string) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, snapshot } = useMeetingSession(meetingRef, onRenamed)
  const [people, setPeople] = useState<Person[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const jumpAfterReload = useRef<{ text: string; occurrence: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.meetings.people.list().then((list) => {
      if (!cancelled) setPeople(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const { meta, body, save, error, conflict, reloadedFromDisk, problems } = snapshot
  const owners = useMemo(() => ownerOptions(meta.attendees, people), [meta.attendees, people])
  const todo = useTodoHelper(owners)
  const topics = useMemo(() => parseTopics(body, meta.discussed), [body, meta.discussed])

  // Back goes to wherever the user came from (the landing page or the list); with no history, the landing page.
  const goBack = (): void =>
    void (location.key !== 'default' ? navigate(-1) : navigate(meetingsBase))

  const addPerson = useCallback(async (name: string): Promise<Person> => {
    const list = await window.api.meetings.people.add({ name })
    setPeople(list)
    const added = list.find(
      (p) => p.name.toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase()
    )
    if (!added) throw new Error('Could not add that person')
    return added
  }, [])

  const toggleTopic = (text: string): void => {
    const has = meta.discussed.includes(text)
    session.setMeta({
      discussed: has ? meta.discussed.filter((t) => t !== text) : [...meta.discussed, text]
    })
  }

  /** Scroll to a topic's heading in the note and put the cursor there. */
  const jumpTo = useCallback((text: string, occurrence: number): void => {
    const root = editorRef.current?.querySelector('.ProseMirror')
    if (!root) return
    const headings = Array.from(root.querySelectorAll('h2, h3')).filter(
      (h) => h.textContent?.trim() === text
    )
    const target = headings[occurrence]
    if (!target) return
    target.scrollIntoView({ block: 'start', behavior: 'smooth' })
    ;(root as HTMLElement).focus({ preventScroll: true })
    const selection = window.getSelection()
    selection?.collapse(target, target.childNodes.length)
  }, [])

  const addTopic = (title: string): void => {
    const next = appendTopic(body, title)
    if (next === body) return
    jumpAfterReload.current = {
      text: title
        .replace(/[\r\n]+/g, ' ')
        .replace(/^#+\s*/, '')
        .replace(/\s+/g, ' ')
        .trim(),
      occurrence: topics.filter((t) => t.text === title.trim()).length
    }
    session.replaceBody(next)
  }

  // After a topic is added the editor is recreated; jump to the new heading once it exists.
  useEffect(() => {
    const pending = jumpAfterReload.current
    if (!pending || snapshot.status !== 'ready') return
    jumpAfterReload.current = null
    const timer = setTimeout(() => jumpTo(pending.text, pending.occurrence), 50)
    return () => clearTimeout(timer)
  }, [snapshot.editorKey, snapshot.status, jumpTo])

  const confirmAndDelete = async (): Promise<void> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await session.dispose() // saves anything pending first
      await window.api.meetings.delete(session.getRef())
      void navigate(meetingsBase)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e))
      setDeleting(false)
      setConfirmDelete(false)
      void session.start()
    }
  }

  const back = (
    <button type="button" className={styles.back} onClick={goBack}>
      <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
      Meetings
    </button>
  )

  if (snapshot.status === 'loading') return <div className={styles.page} />
  if (snapshot.status === 'missing') {
    return (
      <div className={styles.page}>
        {back}
        <EmptyState
          heading="Meeting not found"
          message={`There is no meeting “${meetingRef.id}”. It may have been moved or deleted.`}
        />
      </div>
    )
  }

  const heading = meetingHeading(meta.series, meta.date)

  return (
    <div className={styles.page}>
      {back}
      <div className={styles.head}>
        <h1 className={styles.title}>{heading}</h1>
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
            Delete meeting
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
              This meeting was changed outside the app while you were editing. Nothing has been
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
              Couldn’t save this meeting: {error}
            </Notice>
          )}
          {deleteError && (
            <Notice tone="error" onDismiss={() => setDeleteError(null)}>
              Couldn’t move the meeting to the Trash: {deleteError}
            </Notice>
          )}
          {problems.length > 0 && (
            <Notice>
              This file’s details need a look: {problems.join('; ')}. Nothing has been changed.
            </Notice>
          )}
        </div>
      )}

      <MetaFields
        meta={meta}
        people={people}
        onChange={(patch) => session.setMeta(patch)}
        onAddPerson={addPerson}
      />

      <div className={styles.split}>
        <div className={styles.doc} ref={editorRef}>
          <NotesEditor
            key={snapshot.editorKey}
            initial={snapshot.initialBody}
            placeholder="Write your meeting notes…"
            showPlaceholder={body.trim() === ''}
            setup={todo.setup}
            onChange={session.editBody.bind(session)}
            onBlur={() => void session.flush()}
          />
        </div>
        <TopicsPanel
          topics={topics}
          onToggle={toggleTopic}
          onJump={(topic: Topic, occurrence: number) => jumpTo(topic.text, occurrence)}
          onAdd={addTopic}
        />
      </div>
      {todo.menu}

      <DeleteDialog
        open={confirmDelete}
        heading={heading}
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmAndDelete()}
      />
    </div>
  )
}
