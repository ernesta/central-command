import { ChevronRight, File, Folder, FolderOpen, FolderSymlink, Link2Off } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { IconButton } from '@renderer/components/IconButton'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useSettings } from '@renderer/state/settings-context'
import type { TrainingFolderListing } from '../shared/api'
import styles from './FilesPanel.module.css'

interface FilesPanelProps {
  /** The linked folder, relative to the Trainings folder, or null. */
  folder: string | null
  onChange: (folder: string | null) => void
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The files of an entry's linked folder. They are linked, never copied: the app lists them, opens one
 * with its default app or shows it in Finder, and never moves, renames, writes or deletes anything.
 */
export function FilesPanel({ folder, onChange }: FilesPanelProps): React.JSX.Element {
  const { settings } = useSettings()
  const root = settings.trainingsFolder
  // The sub-folder being shown belongs to one linked folder; a different link starts at its top.
  const [nav, setNav] = useState<{ folder: string | null; sub: string }>({ folder, sub: '' })
  const sub = nav.folder === folder ? nav.sub : ''
  const [loaded, setLoaded] = useState<{ key: string; listing: TrainingFolderListing } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = `${root}|${folder}|${sub}`

  useEffect(() => {
    if (!folder || !root) return
    let cancelled = false
    window.api.training.files
      .list(folder, sub)
      .then((listing) => {
        if (!cancelled) setLoaded({ key, listing })
      })
      .catch((e) => {
        if (!cancelled) setLoaded({ key, listing: { status: 'missing' } })
        if (!cancelled) setError(ipcErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [folder, root, sub, key])

  const listing = loaded?.key === key ? loaded.listing : null

  const link = async (): Promise<void> => {
    setError(null)
    try {
      const picked = await window.api.dialog.pickPath({
        kind: 'folder',
        title: 'Choose the folder for this entry',
        defaultPath: root || undefined
      })
      if (!picked) return
      onChange(await window.api.training.files.toRelative(picked))
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  const act = async (run: () => Promise<void>): Promise<void> => {
    setError(null)
    try {
      await run()
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  const crumbs = sub === '' ? [] : sub.split('/')
  const go = (next: string): void => setNav({ folder, sub: next })

  return (
    <section className={styles.panel} aria-labelledby="training-files">
      <div className={styles.head}>
        <h2 id="training-files" className={styles.label}>
          Files
        </h2>
        <div className={styles.actions}>
          {folder && root && (
            <IconButton
              className={styles.iconAction}
              label="Show in Finder"
              onClick={() => void act(() => window.api.training.files.reveal(folder, sub, ''))}
            >
              <FolderOpen size={15} strokeWidth={1.75} aria-hidden />
            </IconButton>
          )}
          {folder && (
            <IconButton
              className={styles.iconAction}
              label="Unlink folder"
              onClick={() => onChange(null)}
            >
              <Link2Off size={15} strokeWidth={1.75} aria-hidden />
            </IconButton>
          )}
          {root && folder && (
            <IconButton
              className={styles.iconAction}
              label="Change folder"
              onClick={() => void link()}
            >
              <FolderSymlink size={15} strokeWidth={1.75} aria-hidden />
            </IconButton>
          )}
          {root && !folder && (
            <Button size="small" onClick={() => void link()}>
              Link a folder…
            </Button>
          )}
        </div>
      </div>

      {!root && (
        <p className={styles.quiet}>
          Choose the Trainings folder in Settings to link a folder of slides and readings to this
          entry.
        </p>
      )}
      {root && !folder && (
        <p className={styles.quiet}>
          No folder linked. Files stay where they are; the entry only points to them.
        </p>
      )}
      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}

      {root && folder && (
        <>
          <nav className={styles.crumbs} aria-label="Folder path">
            <button type="button" className={styles.crumb} onClick={() => go('')}>
              {folder.split('/').at(-1)}
            </button>
            {crumbs.map((name, i) => (
              <span key={crumbs.slice(0, i + 1).join('/')} className={styles.crumbGroup}>
                <ChevronRight size={12} strokeWidth={1.75} aria-hidden />
                <button
                  type="button"
                  className={styles.crumb}
                  onClick={() => go(crumbs.slice(0, i + 1).join('/'))}
                >
                  {name}
                </button>
              </span>
            ))}
          </nav>
          {listing?.status === 'missing' && (
            <p className={styles.quiet}>
              The folder “{folder}” is not there. It may have been moved or renamed; the link is
              kept.
            </p>
          )}
          {listing?.status === 'no-root' && (
            <p className={styles.quiet}>The Trainings folder in Settings is not a folder.</p>
          )}
          {listing?.status === 'ok' &&
            (listing.entries.length === 0 ? (
              <p className={styles.quiet}>This folder is empty.</p>
            ) : (
              <ul className={styles.list}>
                {listing.entries.map((entry) => (
                  <li key={entry.name}>
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() =>
                        entry.kind === 'folder'
                          ? go(sub === '' ? entry.name : `${sub}/${entry.name}`)
                          : void act(() => window.api.training.files.open(folder, sub, entry.name))
                      }
                    >
                      {entry.kind === 'folder' ? (
                        <Folder size={15} strokeWidth={1.75} aria-hidden />
                      ) : (
                        <File size={15} strokeWidth={1.75} aria-hidden />
                      )}
                      <span className={styles.name}>{entry.name}</span>
                      <span className={styles.size}>{formatSize(entry.size)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </section>
  )
}
