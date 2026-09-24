import { useEffect, useState, useSyncExternalStore } from 'react'
import { registerFlushable } from '@renderer/lib/flush-registry'
import type { MeetingRef } from '../shared/types'
import { MeetingSession, type MeetingSnapshot } from './meeting-session'

/**
 * Opens a MeetingSession for one meeting. Render the component that uses this with `key={id}` so each
 * meeting gets its own session; it is disposed (saving anything pending) when the component unmounts.
 */
export function useMeetingSession(
  ref: MeetingRef,
  onRenamed?: (id: string) => void
): {
  session: MeetingSession
  snapshot: MeetingSnapshot
} {
  const [session] = useState(() => new MeetingSession(ref, window.api.meetings))
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
