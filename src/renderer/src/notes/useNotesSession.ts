import { useEffect, useState, useSyncExternalStore } from 'react'
import { registerFlushable } from '@renderer/lib/flush-registry'
import { NotesSession, type NotesApi, type NotesSnapshot } from './notes-session'

/**
 * Opens a NotesSession for one note, identified by `citekey` (the note's key in whichever module
 * owns `api`). Render the component that uses this with `key={citekey}` so each note gets its own
 * session; it is disposed (saving anything pending) when the component unmounts.
 */
export function useNotesSession(
  citekey: string,
  api: NotesApi
): {
  session: NotesSession
  snapshot: NotesSnapshot
} {
  const [session] = useState(() => new NotesSession(citekey, api))

  useEffect(() => {
    void session.start()
    // Last-chance save if the window closes while a save is pending.
    const onPageHide = (): void => void session.flush()
    window.addEventListener('pagehide', onPageHide)
    // Also saved when the window is closed or the app quits (see App).
    const unregister = registerFlushable(() => session.flush())
    return () => {
      unregister()
      window.removeEventListener('pagehide', onPageHide)
      void session.dispose()
    }
  }, [session])

  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  return { session, snapshot }
}
