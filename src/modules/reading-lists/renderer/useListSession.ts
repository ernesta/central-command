import { useEffect, useState, useSyncExternalStore } from 'react'
import { registerFlushable } from '@renderer/lib/flush-registry'
import type { ReadingListRef } from '../shared/types'
import { ListSession, type ListSnapshot } from './list-session'

/**
 * Opens a ListSession for one reading list. Render the component that uses this with `key={id}` so
 * each list gets its own session; it is disposed (saving anything pending) when the component unmounts.
 */
export function useListSession(
  ref: ReadingListRef,
  onRenamed?: (id: string) => void
): { session: ListSession; snapshot: ListSnapshot } {
  const [session] = useState(() => new ListSession(ref, window.api.readingLists))
  useEffect(() => {
    session.setOnRenamed(onRenamed)
  })

  useEffect(() => {
    void session.start()
    const onPageHide = (): void => void session.flush()
    window.addEventListener('pagehide', onPageHide)
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
