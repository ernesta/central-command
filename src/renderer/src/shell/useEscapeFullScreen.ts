import { useEffect } from 'react'

const EDITABLE =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor'
const OPEN_LAYER = 'dialog[open], [role="menu"], [role="listbox"], [role="dialog"]'

const layerOpen = (): boolean => document.querySelector(OPEN_LAYER) !== null

/**
 * Whether a plain Escape should leave full screen. Not when something already used the key (a handler that called
 * `preventDefault` or `stopPropagation`), nor when it is the way out of something else: a text field or editor with the
 * cursor in it (Escape cancels the edit), an open dialog or menu, or a button that has a popup open. `active` and
 * `layers` are what the page looked like when the key went down: by the time the event reaches `window` a handler may
 * have closed the form and unmounted the focused field, which would make the key look unwanted.
 */
export function escapeLeavesFullScreen(
  event: KeyboardEvent,
  active: Element | null,
  layers: boolean = layerOpen()
): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return false
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false
  if (active?.closest(EDITABLE)) return false
  if (active?.closest('[aria-expanded="true"]')) return false
  return !layers
}

/**
 * Listens on `target` and calls `leave` for an Escape nothing wanted. The page is read in the capture phase, before any
 * handler runs (a handler that closes a form unmounts the focused field, so afterwards the focus is on `body` and the key
 * looks unused: that is how Escape in Hours' Add form left full screen); the decision is made in the bubble phase, so a
 * handler's `preventDefault` or `stopPropagation` still counts.
 */
export function listenForEscape(target: Window, leave: () => void): () => void {
  let seen: { active: Element | null; layers: boolean } | null = null
  const onCapture = (): void => {
    seen = { active: document.activeElement, layers: layerOpen() }
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    const before = seen
    seen = null
    if (
      escapeLeavesFullScreen(event, before ? before.active : document.activeElement, before?.layers)
    )
      leave()
  }
  target.addEventListener('keydown', onCapture, true)
  target.addEventListener('keydown', onKeyDown)
  return () => {
    target.removeEventListener('keydown', onCapture, true)
    target.removeEventListener('keydown', onKeyDown)
  }
}

/**
 * Escape leaves full screen, as in most Mac apps, but only when nothing else wanted it. The decision is made here
 * rather than in the main process, which cannot know whether the page used the key to close a field or a pop-up.
 */
export function useEscapeFullScreen(): void {
  useEffect(() => listenForEscape(window, () => void window.api.app.leaveFullScreen()), [])
}
