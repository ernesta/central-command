import { useEffect, useState, useSyncExternalStore } from 'react'
import { registerFlushable } from '@renderer/lib/flush-registry'
import { NotesSession, type NotesSnapshot } from './notes-session'

/**
 * Opens a NotesSession for one reading's notes. Render the component that uses this with
 * `key={citekey}` so each reading gets its own session; it is disposed (saving anything
 * pending) when the component unmounts.
 */
export function useNotesSession(citekey: string): {
  session: NotesSession
  snapshot: NotesSnapshot
} {
  const [session] = useState(() => new NotesSession(citekey, window.api.readings.notes))

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
