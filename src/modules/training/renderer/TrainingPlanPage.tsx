import { ArrowLeft, FolderOpen } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { AcademicYearSelect } from '@renderer/components/AcademicYearSelect'
import { Button } from '@renderer/components/Button'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { NotesEditor } from '@renderer/notes/NotesEditor'
import type { SaveState } from '@renderer/notes/notes-session'
import { useNotesSession } from '@renderer/notes/useNotesSession'
import { useAcademicYear } from '@renderer/state/use-academic-year'
import { academicYearLabel, academicYearRange, currentAcademicYear } from '@shared/academic-year'
import { planOutline, type OutlineItem } from '../shared/plan'
import { todayIso, trainingBase } from './training-paths'
import { useTrainingList } from './useTrainingList'
import styles from './TrainingPlanPage.module.css'

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

/** The training plan of one academic year: a Markdown document with an outline of its headings. */
export function TrainingPlanPage(): React.JSX.Element {
  const { rows } = useTrainingList()
  const today = todayIso()
  // The next academic year is always offered, so a plan can be written before its year starts.
  const { year, years, setYear } = useAcademicYear(
    [...(rows ?? []).map((r) => r.date), academicYearRange(currentAcademicYear(today) + 1).from],
    today
  )
  const [folderError, setFolderError] = useState<string | null>(null)

  const openFolder = async (): Promise<void> => {
    setFolderError(null)
    try {
      await window.api.training.plan.reveal()
    } catch (e) {
      setFolderError(`Couldn’t open the folder: ${ipcErrorMessage(e)}`)
    }
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={trainingBase}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Training
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>Training plan</h1>
        <div className={styles.actions}>
          <AcademicYearSelect year={year} years={years} onChange={setYear} />
          <Button
            icon={<FolderOpen size={14} strokeWidth={1.75} aria-hidden />}
            title="Open the folder that holds the plans"
            onClick={() => void openFolder()}
          >
            Open folder
          </Button>
        </div>
      </header>
      {folderError && (
        <Notice tone="error" onDismiss={() => setFolderError(null)}>
          {folderError}
        </Notice>
      )}
      <PlanView key={year} year={year} />
    </div>
  )
}

/** The outline entry's heading in the editor: the first heading of that level with that text. */
function scrollToHeading(root: HTMLElement | null, item: OutlineItem): void {
  const tag = item.level === 2 ? 'h2' : 'h3'
  const heading = Array.from(root?.querySelectorAll<HTMLElement>(`.ProseMirror ${tag}`) ?? []).find(
    (h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim() === item.text
  )
  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function PlanView({ year }: { year: number }): React.JSX.Element {
  const { session, snapshot } = useNotesSession(String(year), window.api.training.plan)
  const { save, error, conflict, hasContent, reloadedFromDisk } = snapshot
  // The outline follows what is typed. The text is tagged with the editor it came from, so a reload
  // from disk (a new editor) starts from the file's text again.
  const [typed, setTyped] = useState<{ editorKey: number; text: string } | null>(null)
  const text = typed && typed.editorKey === snapshot.editorKey ? typed.text : snapshot.initial
  const outline = planOutline(text)
  const docRef = useRef<HTMLElement>(null)

  return (
    <div className={styles.layout}>
      <nav className={styles.outline} aria-label="Outline">
        {outline.length === 0 ? (
          <p className={styles.outlineEmpty}>Headings you write appear here.</p>
        ) : (
          outline.map((item, i) => (
            <button
              key={`${i}-${item.text}`}
              type="button"
              className={item.level === 2 ? styles.group : styles.item}
              onClick={() => scrollToHeading(docRef.current, item)}
            >
              {item.text}
            </button>
          ))
        )}
      </nav>
      <section
        className={styles.doc}
        ref={docRef}
        aria-label={`Training plan ${academicYearLabel(year)}`}
      >
        <div className={styles.docHead}>
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
                This plan was changed outside the app while you were editing. Nothing has been
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
                Couldn’t save your plan: {error}
              </Notice>
            )}
          </div>
        )}
        {snapshot.status === 'ready' && (
          <NotesEditor
            key={snapshot.editorKey}
            initial={snapshot.initial}
            placeholder={`Write your training plan for ${academicYearLabel(year)}: priorities as headings, with what, why and how under each.`}
            showPlaceholder={!hasContent}
            onChange={(markdown) => {
              session.edit(markdown)
              setTyped({ editorKey: snapshot.editorKey, text: markdown })
            }}
            onBlur={() => void session.flush()}
          />
        )}
      </section>
    </div>
  )
}
