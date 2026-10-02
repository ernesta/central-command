import { ArrowLeft, FolderOpen } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { YearSelect } from '@renderer/components/YearSelect'
import { Button } from '@renderer/components/Button'
import { IconButton } from '@renderer/components/IconButton'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { EditorCard } from '@renderer/notes/EditorCard'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import { useNotesSession } from '@renderer/notes/useNotesSession'
import { NoteOutline } from '@modules/notes/renderer/NoteOutline'
import { useYear } from '@renderer/state/use-year'
import { nextYearStart, yearLabel } from '@shared/year'
import { useSettings } from '@renderer/state/settings-context'
import { planKey } from '../shared/plan'
import { todayIso, trainingBase } from './training-paths'
import { useTrainingList } from './useTrainingList'
import styles from './TrainingPlanPage.module.css'

/** The training plan of one year: a Markdown document with an outline of its headings. */
export function TrainingPlanPage(): React.JSX.Element {
  const { rows } = useTrainingList()
  const today = todayIso()
  const { settings } = useSettings()
  // The next year is always offered, so a plan can be written before its year starts.
  const { year, years, setYear } = useYear(
    [...(rows ?? []).map((r) => r.date), nextYearStart(today, settings.yearStarts)],
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
          <YearSelect year={year} years={years} onChange={setYear} />
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

function PlanView({ year }: { year: string }): React.JSX.Element {
  const { session, snapshot } = useNotesSession(String(planKey(year)), window.api.training.plan)
  const { save, error, conflict, hasContent, reloadedFromDisk, updatedAt } = snapshot
  // The outline follows what is typed. The text is tagged with the editor it came from, so a reload
  // from disk (a new editor) starts from the file's text again.
  const [typed, setTyped] = useState<{ editorKey: number; text: string } | null>(null)
  const text = typed && typed.editorKey === snapshot.editorKey ? typed.text : snapshot.initial
  const docRef = useRef<HTMLElement>(null)

  return (
    <div className={styles.layout}>
      <section className={styles.doc} ref={docRef} aria-label={`Training plan ${yearLabel(year)}`}>
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
              placeholder={`Write your training plan for ${yearLabel(year)}: priorities as headings, with what, why and how under each.`}
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
