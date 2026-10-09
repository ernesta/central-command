import { useEffect } from 'react'

const EDITABLE =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor'
const OPEN_LAYER = 'dialog[open], [role="menu"], [role="listbox"], [role="dialog"]'

/**
 * Whether a plain Escape should leave full screen. Not when something already used the key (a handler that called
 * `preventDefault` or `stopPropagation`), nor when it is the way out of something else: a text field or editor with the
 * cursor in it (Escape cancels the edit), an open dialog or menu, or a button that has a popup open.
 */
export function escapeLeavesFullScreen(event: KeyboardEvent, active: Element | null): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return false
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false
  if (active?.closest(EDITABLE)) return false
  if (active?.closest('[aria-expanded="true"]')) return false
  return document.querySelector(OPEN_LAYER) === null
}

/**
 * Escape leaves full screen, as in most Mac apps, but only when nothing else wanted it. The decision is made here
 * rather than in the main process, which cannot know whether the page used the key to close a field or a pop-up.
 */
export function useEscapeFullScreen(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (escapeLeavesFullScreen(event, document.activeElement))
        void window.api.app.leaveFullScreen()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
