import { useSyncExternalStore } from 'react'
import type { Workspace } from '@shared/settings'

/**
 * A wish to open the running timer's picker (the popover in the top bar): after a timer started at once with no task, or
 * when stopping a timer that has none. `nonce` makes every request new, even with the same words.
 */
export interface PickerRequest {
  /** Typed into the field already (an older entry's name, say). */
  query: string
  /** Stop the timer once it has its task. */
  stopAfter: boolean
  nonce: number
}

let current: PickerRequest | null = null
let nonce = 0
const listeners = new Set<() => void>()

export function requestPicker(options: { query?: string; stopAfter?: boolean } = {}): void {
  current = { query: options.query ?? '', stopAfter: options.stopAfter ?? false, nonce: ++nonce }
  for (const l of listeners) l()
}

export function clearPickerRequest(): void {
  if (current === null) return
  current = null
  for (const l of listeners) l()
}

/** The request now open, if any (for code outside React). */
export function currentPickerRequest(): PickerRequest | null {
  return current
}

export function usePickerRequest(): PickerRequest | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}

/** Start the timer at once with no task; the picker then opens for it (the one rule for "Start" everywhere). */
export async function startUnnamed(
  workspace: Workspace,
  label = '',
  client?: string
): Promise<void> {
  const result = await window.api.tracking.start(workspace, label, undefined, client)
  if (result.ok) requestPicker({ query: label })
}

/**
 * Stop the timer. One that has no task asks for one first (every hour has a task): the picker opens, and the timer stops
 * when it has been given one.
 */
export async function stopTimer(): Promise<void> {
  const running = await window.api.tracking.running()
  if (running && !running.session.task) requestPicker({ stopAfter: true })
  else await window.api.tracking.stop()
}
