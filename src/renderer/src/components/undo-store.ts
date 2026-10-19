import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { clearToast, showToast } from './toast-store'

/**
 * How the app lets the person take something back (`docs/DECISIONS.md`, "One rule for undo"). Nothing asks first, except where
 * nothing could be undone (merging two people, a rename that rewrites notes).
 *
 * - A record goes away (a row, page, person, contract, a discarded timer): `pushUndoWithToast`, a toast with Undo, and Cmd-Z.
 * - A value changes in place (an edit, a chip, a status, a move, a plan): `pushUndo`, Cmd-Z only, silent.
 * - Something is added, or it is routine (new, start, stop): no entry; deleting is the undo. A page nothing was typed into goes
 *   without a word, since nothing is lost.
 *
 * Cmd-Z always says what it undid ("Undid the move to Work."), since the change may be off screen.
 */

/** One thing the person did that Cmd-Z (or the toast's Undo) can take back. */
export interface UndoEntry {
  /** What it was, as a noun phrase: "Undid the {label}." and "Couldn’t undo the {label}" ("status change", "deletion of “X”"). */
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
export async function undoEntry(entry: UndoEntry): Promise<boolean> {
  if (!stack.includes(entry)) return false
  stack = stack.filter((e) => e !== entry)
  try {
    await entry.undo()
    return true
  } catch (error) {
    showToast(`Couldn’t undo the ${entry.label}: ${ipcErrorMessage(error)}`)
    return false
  }
}

/** Cmd-Z: take back the latest change and say what it was. Resolves with whether there was one. */
export async function undoLast(): Promise<boolean> {
  stack = stack.filter((e) => !e.isStale?.())
  const entry = stack[stack.length - 1]
  if (!entry) return false
  clearToast()
  if (await undoEntry(entry)) showToast(`Undid the ${entry.label}.`)
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
