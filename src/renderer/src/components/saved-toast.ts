import { showToast } from './toast-store'

/** The message after an export saved a PDF, with a button that opens it. */
export function showSavedToast(text: string): void {
  showToast(text, { label: 'Open', run: () => void window.api.app.openExport() })
}
