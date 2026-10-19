import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { clearToast, showToast } from './toast-store'

/** One thing the person did that Cmd-Z (or the toast's Undo) can take back. */
export interface UndoEntry {
  /** What it was, for a failure message ("status change"). */
  label: string
  undo: () => Promise<void> | void
  /** True once the thing it would change is gone (its page was left): Cmd-Z then skips it instead of acting on nothing. */
  isStale?: () => boolean
}

const LIMIT = 50
let stack: UndoEntry[] = []

/** Remember a change. The latest is the first Cmd-Z takes back; nothing is shown. */
export function pushUndo(entry: UndoEntry): UndoEntry {
  stack = [...stack.slice(-(LIMIT - 1)), entry]
  return entry
}

/** Take one entry back, wherever it was asked from (it can be undone once). */
export async function undoEntry(entry: UndoEntry): Promise<void> {
  if (!stack.includes(entry)) return
  stack = stack.filter((e) => e !== entry)
  try {
    await entry.undo()
  } catch (error) {
    showToast(`Couldn’t undo the ${entry.label}: ${ipcErrorMessage(error)}`)
  }
}

/** Cmd-Z: take back the latest change. Resolves with whether there was one. */
export async function undoLast(): Promise<boolean> {
  stack = stack.filter((e) => !e.isStale?.())
  const entry = stack[stack.length - 1]
  if (!entry) return false
  clearToast()
  await undoEntry(entry)
  return true
}

/** For significant changes (deletions): remember the change and also show a toast whose Undo does the same as Cmd-Z. */
export function pushUndoWithToast(text: string, entry: UndoEntry): void {
  pushUndo(entry)
  showToast(text, { label: 'Undo', run: () => void undoEntry(entry) })
}

export function clearUndoStack(): void {
  stack = []
}
