/** The message of an error from the main process, without Electron's "Error invoking remote method …" prefix. */
export function ipcErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '')
}
