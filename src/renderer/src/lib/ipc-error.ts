/** The message of an error from the main process, without Electron's "Error invoking remote method …" prefix. */
export function ipcErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '')
}

/** A file-system error in plain words (the raw message names a path and an error code); anything else is returned as it is. */
export function friendlyFileError(message: string): string {
  if (/\bE(ACCES|PERM)\b/.test(message)) {
    return 'Central Command is not allowed to write there. Check the permissions of the notes folder.'
  }
  if (/\bENOSPC\b/.test(message)) return 'The disk is full.'
  if (/\bEROFS\b/.test(message)) return 'The notes folder is read-only.'
  return message
}
