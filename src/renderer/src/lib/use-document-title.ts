import { useEffect } from 'react'
import { APP_NAME } from '@shared/app-info'

/** The window title for a page: "Methods · Central Command", or just the app's name when there is no title (yet). */
export function windowTitle(title: string | null | undefined): string {
  const trimmed = title?.trim()
  return trimmed ? `${trimmed} · ${APP_NAME}` : APP_NAME
}

/**
 * Names the window after the page that is open (a note, a meeting, a reading), so the Window menu, Mission Control and the
 * Dock show which one is which. Goes back to the app's name when the page is left.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = windowTitle(title)
    return () => {
      document.title = APP_NAME
    }
  }, [title])
}
