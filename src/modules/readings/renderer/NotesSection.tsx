import { Button } from '@renderer/components/Button'
import { Notice } from '@renderer/components/Notice'
import type { SaveState } from './notes-session'
import { NotesEditor } from './NotesEditor'
import { useNotesSession } from './useNotesSession'
import styles from './NotesSection.module.css'

function statusText(save: SaveState, hasContent: boolean, reloaded: boolean): string {
  switch (save) {
    case 'saving':
      return 'Saving…'
    case 'dirty':
      return 'Unsaved changes'
    case 'error':
      return 'Couldn’t save'
    case 'clean':
      if (reloaded) return 'Updated from an outside change'
      return hasContent ? 'Saved' : ''
  }
}

/**
 * A reading's notes: a live-render Markdown editor backed by `<citekey>.md`, with autosave and
 * calm handling of the file changing underneath. Render with `key={citekey}`.
 */
export function NotesSection({ citekey }: { citekey: string }): React.JSX.Element {
  const { session, snapshot } = useNotesSession(citekey)
  const { save, error, conflict, hasContent, reloadedFromDisk } = snapshot

  return (
    <section className={styles.section} aria-label="Notes">
      <div className={styles.header}>
        <h2 className={styles.label}>Notes</h2>
        <span
          className={[styles.status, save === 'error' && styles.statusError]
            .filter(Boolean)
            .join(' ')}
          role="status"
        >
          {statusText(save, hasContent, reloadedFromDisk)}
        </span>
      </div>

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
        <NotesEditor
          key={snapshot.editorKey}
          initial={snapshot.initial}
          placeholder="Start writing your notes…"
          showPlaceholder={!hasContent}
          onChange={session.edit.bind(session)}
          onBlur={() => void session.flush()}
        />
      )}
    </section>
  )
}
