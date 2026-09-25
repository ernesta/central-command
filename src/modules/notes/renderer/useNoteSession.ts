import { useEffect, useState, useSyncExternalStore } from 'react'
import { registerFlushable } from '@renderer/lib/flush-registry'
import type { NoteRef } from '../shared/types'
import { NoteSession, type NoteSnapshot } from './note-session'

/**
 * Opens a NoteSession for one note. Render the component that uses this with `key={id}` so each
 * note gets its own session; it is disposed (saving anything pending) when the component unmounts.
 */
export function useNoteSession(
  ref: NoteRef,
  onRenamed?: (id: string) => void
): { session: NoteSession; snapshot: NoteSnapshot } {
  const [session] = useState(() => new NoteSession(ref, window.api.notes))
  useEffect(() => {
    session.setOnRenamed(onRenamed)
  })

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
