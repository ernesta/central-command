import { useEffect, useState, useSyncExternalStore } from 'react'
import { registerFlushable } from '@renderer/lib/flush-registry'
import type { TrainingRef } from '../shared/types'
import { TrainingSession, type TrainingSnapshot } from './training-session'

/**
 * Opens a TrainingSession for one entry. Render the component that uses this with `key={id}` so each
 * entry gets its own session; it is disposed (saving anything pending) when the component unmounts.
 */
export function useTrainingSession(
  ref: TrainingRef,
  onRenamed?: (id: string) => void
): { session: TrainingSession; snapshot: TrainingSnapshot } {
  const [session] = useState(() => new TrainingSession(ref, window.api.training))
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
