/** A file kept beside the notes, as the picker and the hover card show it. */
export interface EntityFile {
  /** The path inside the notes folder, `research/Data Sources Summary.xlsx`; this is what a mention's address holds. */
  key: string
  /** The file's name with its extension. */
  name: string
  /** The workspace folder it sits in. */
  workspace: string
  size: number
}

/**
 * Whether a key is a path inside the notes folder and nothing else: relative, no `..`, no hidden parts. The main process
 * checks every key with this before touching the disk, so a hand-written link cannot reach outside the folder.
 */
export function isSafeFileKey(key: string): boolean {
  if (!key || key.startsWith('/') || key.includes('\\') || key.includes('\0')) return false
  return key
    .split('/')
    .every((part) => part !== '' && part !== '.' && part !== '..' && !part.startsWith('.'))
}
