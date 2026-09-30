import { ArrowLeft, FolderOpen } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { AcademicYearSelect } from '@renderer/components/AcademicYearSelect'
import { Button } from '@renderer/components/Button'
import { IconButton } from '@renderer/components/IconButton'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { EditorCard } from '@renderer/notes/EditorCard'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import { useNotesSession } from '@renderer/notes/useNotesSession'
import { NoteOutline } from '@modules/notes/renderer/NoteOutline'
import { useAcademicYear } from '@renderer/state/use-academic-year'
import { academicYearLabel, academicYearRange, currentAcademicYear } from '@shared/academic-year'
import { todayIso, trainingBase } from './training-paths'
import { useTrainingList } from './useTrainingList'
import styles from './TrainingPlanPage.module.css'

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
          <IconButton label="Show in Finder" onClick={() => void openFolder()}>
            <FolderOpen size={15} strokeWidth={1.75} aria-hidden />
          </IconButton>
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

function PlanView({ year }: { year: number }): React.JSX.Element {
  const { session, snapshot } = useNotesSession(String(year), window.api.training.plan)
  const { save, error, conflict, hasContent, reloadedFromDisk, updatedAt } = snapshot
  // The outline follows what is typed. The text is tagged with the editor it came from, so a reload
  // from disk (a new editor) starts from the file's text again.
  const [typed, setTyped] = useState<{ editorKey: number; text: string } | null>(null)
  const text = typed && typed.editorKey === snapshot.editorKey ? typed.text : snapshot.initial
  const docRef = useRef<HTMLElement>(null)

  return (
    <div className={styles.layout}>
      <section
        className={styles.doc}
        ref={docRef}
        aria-label={`Training plan ${academicYearLabel(year)}`}
      >
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
              placeholder={`Write your training plan for ${academicYearLabel(year)}: priorities as headings, with what, why and how under each.`}
              showPlaceholder={!hasContent}
              onChange={(markdown) => {
                session.edit(markdown)
                setTyped({ editorKey: snapshot.editorKey, text: markdown })
              }}
              onBlur={() => void session.flush()}
            />
          </EditorCard>
        )}
      </section>
      <NoteOutline text={text} docRef={docRef} />
    </div>
  )
}
