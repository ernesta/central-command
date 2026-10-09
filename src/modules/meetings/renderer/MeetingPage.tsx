import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { DeleteDialog } from '@renderer/components/DeleteDialog'
import { isUntouchedBody } from '@renderer/components/untouched'
import { NEW_MEETING_BODY } from '../shared/front-matter'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { WorkspaceSelect } from '@renderer/components/WorkspaceSelect'
import { liveViewIn, placeCursorOnLine } from '@renderer/editor/live-outline'
import { EditorCard } from '@renderer/notes/EditorCard'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import { seriesOptions } from '../shared/query'
import { meetingHeading } from '../shared/time'
import { appendTopic, parseTopics, topicOffset, type Topic } from '../shared/topics'
import { fixedSeries, type MeetingRef, type MeetingWorkspace, type Person } from '../shared/types'
import { meetingRoute, meetingsBase, useMeetingsWorkspace } from './meetings-paths'
import { MeetingHoursNote } from './MeetingHoursNote'
import { MetaFields } from './MetaFields'
import { MentionedIn } from '@renderer/entities/MentionedIn'
import { TopicsPanel } from './TopicsPanel'
import { useMeetingsList } from './useMeetingsList'
import { useMeetingSession } from './useMeetingSession'
import styles from './MeetingPage.module.css'

/** One meeting: its details, its note (Summary, Previous TODOs, Notes) and the topics panel. */
export function MeetingPage(): React.JSX.Element {
  // A move to the other workspace starts the page afresh: the names the item had in the first one mean nothing in the second.
  const workspace = useMeetingsWorkspace()
  return <MeetingPageIn key={workspace} workspace={workspace} />
}

function MeetingPageIn({ workspace }: { workspace: MeetingWorkspace }): React.JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // Changing the date or series renames the file, and so changes the id in the address. The page keeps
  // its state (and the cursor) by staying mounted under the id it opened with: `ids` are the names this
  // meeting has had, so the address moving from one to the next does not remount it.
  const [known, setKnown] = useState<{ key: string; ids: string[] }>({ key: id, ids: [id] })
  const key = known.ids.includes(id) ? known.key : id
  return (
    <MeetingView
      key={`${workspace}/${key}`}
      meetingRef={{ workspace, id: key }}
      onRenamed={(newId) => {
        setKnown((prev) =>
          prev.key === key ? { key, ids: [...prev.ids, newId] } : { key, ids: [key, newId] }
        )
        void navigate(meetingRoute(workspace, newId), { replace: true })
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
  const { rows: meetingRows } = useMeetingsList(meetingRef.workspace)
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

  const { meta, body, save, error, conflict, reloadedFromDisk, problems, updatedAt } = snapshot
  useDocumentTitle(meta.series || meta.date ? meetingHeading(meta.series, meta.date) : null)
  const topics = useMemo(() => parseTopics(body, meta.discussed), [body, meta.discussed])

  // Back goes to wherever the user came from (the landing page or the list); with no history, the landing page.
  const goBack = (): void =>
    void (location.key !== 'default' ? navigate(-1) : navigate(meetingsBase(meetingRef.workspace)))

  const addPerson = useCallback(async (name: string): Promise<Person> => {
    const list = await window.api.meetings.people.add({ name })
    setPeople(list)
    const added = list.find(
      (p) => p.name.toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase()
    )
    if (!added) throw new Error('Couldn’t add that person')
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
    const live = liveViewIn(editorRef.current)
    if (!live) return
    // The editor draws only the lines near the screen: go by position, through the view.
    const pos = topicOffset(live.state.doc.toString(), text, occurrence)
    if (pos !== null) placeCursorOnLine(live, pos)
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

  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const moveTo = async (target: 'research' | 'work'): Promise<void> => {
    setMoving(true)
    setMoveError(null)
    try {
      await session.dispose() // saves anything pending first
      const moved = await window.api.meetings.move(session.getRef(), target)
      void navigate(meetingRoute(moved.ref.workspace, moved.ref.id), { replace: true })
    } catch (e) {
      setMoveError(ipcErrorMessage(e))
      setMoving(false)
      void session.start()
    }
  }

  // A page nothing was typed into goes without asking.
  const untouched = isUntouchedBody(body, NEW_MEETING_BODY)

  const confirmAndDelete = async (): Promise<void> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await session.dispose() // saves anything pending first
      await window.api.meetings.delete(session.getRef())
      void navigate(meetingsBase(meetingRef.workspace))
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
          <WorkspaceSelect
            compact
            value={meetingRef.workspace}
            disabled={moving}
            onChange={(target) => void moveTo(target)}
          />
          <Button
            size="small"
            variant="danger-outline"
            onClick={() => (untouched ? void confirmAndDelete() : setConfirmDelete(true))}
          >
            Delete meeting
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
          {moveError && (
            <Notice tone="error" onDismiss={() => setMoveError(null)}>
              Couldn’t move the meeting: {moveError}
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
        workspace={meetingRef.workspace}
        seriesSuggestions={seriesOptions(meetingRows ?? [], fixedSeries(meetingRef.workspace))}
        meta={meta}
        people={people}
        onChange={(patch) => session.setMeta(patch)}
        onAddPerson={addPerson}
      />
      <MeetingHoursNote workspace={meetingRef.workspace} id={meetingRef.id} meta={meta} />

      <div className={styles.split}>
        <div className={styles.doc} ref={editorRef}>
          <EditorCard text={body} edited={updatedAt} save={save} reloaded={reloadedFromDisk}>
            <LiveEditor
              key={snapshot.editorKey}
              initial={snapshot.initialBody}
              placeholder="Write your meeting notes…"
              showPlaceholder={body.trim() === ''}
              attendees={meta.attendees}
              entitySelf={{
                kind: 'meeting',
                workspace: meetingRef.workspace,
                id: session.getRef().id
              }}
              onChange={session.editBody.bind(session)}
              onBlur={() => void session.flush()}
            />
          </EditorCard>
        </div>
        <div className={styles.side}>
          <TopicsPanel
            topics={topics}
            onToggle={toggleTopic}
            onJump={(topic: Topic, occurrence: number) => jumpTo(topic.text, occurrence)}
            onAdd={addTopic}
          />
          <MentionedIn
            kind="meeting"
            entityKey={meetingRows?.find((r) => r.id === session.getRef().id)?.uid || null}
          />
        </div>
      </div>

      <DeleteDialog
        open={confirmDelete}
        heading={heading}
        noun="meeting"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmAndDelete()}
      />
    </div>
  )
}
