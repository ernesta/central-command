import { useEffect } from 'react'

/**
 * Pastes `text` into whatever has the cursor, with no formatting. A text field takes it as typed text. An editor
 * is handed a paste event that carries only plain text, which it treats as any other paste of plain text.
 */
export function pastePlainText(text: string): void {
  const target = document.activeElement
  if (!(target instanceof HTMLElement) || text === '') return
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    document.execCommand('insertText', false, text)
    return
  }
  if (!target.isContentEditable) return
  const data = new DataTransfer()
  data.setData('text/plain', text)
  target.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
  )
}

/** Cmd-Shift-V: the main process catches the chord (the menu would otherwise take it) and sends the clipboard's text. */
export function usePastePlain(): void {
  useEffect(() => window.api.app.onPastePlain(pastePlainText), [])
}
