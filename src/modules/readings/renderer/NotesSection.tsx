import { Button } from '@renderer/components/Button'
import { Notice } from '@renderer/components/Notice'
import { EditorCard } from '@renderer/notes/EditorCard'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import type { NotesSession, NotesSnapshot } from '@renderer/notes/notes-session'
import styles from './NotesSection.module.css'

/**
 * A reading's notes: a live-render Markdown editor backed by `<citekey>.md`, with autosave and
 * calm handling of the file changing underneath. The session is opened by the page, which also
 * draws the outline of these headings beside it.
 */
export function NotesSection({
  session,
  snapshot
}: {
  session: NotesSession
  snapshot: NotesSnapshot
}): React.JSX.Element {
  const { save, error, conflict, hasContent, reloadedFromDisk, text, updatedAt } = snapshot

  return (
    <section className={styles.section} aria-label="Notes">
      <h2 className={styles.label}>Notes</h2>

      {(conflict || error) && (
        <div className={styles.notices}>
          {conflict && (
            <Notice
              action={
                <span className={styles.actions}>
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
              Couldn’t save your notes: {error}
            </Notice>
          )}
        </div>
      )}

      {snapshot.status === 'ready' && (
        <EditorCard
          text={text}
          edited={updatedAt}
          save={save}
          reloaded={reloadedFromDisk}
          hasContent={hasContent}
        >
          <LiveEditor
            key={snapshot.editorKey}
            initial={snapshot.initial}
            placeholder="Start writing your notes…"
            showPlaceholder={!hasContent}
            onChange={session.edit.bind(session)}
            onBlur={() => void session.flush()}
          />
        </EditorCard>
      )}
    </section>
  )
}
