export type SaveState = 'clean' | 'dirty' | 'saving' | 'error'

/**
 * Holds a text that is being edited and writes it with `save`. `change` is synchronous: the text it was given is the text
 * `current` returns at once and the state is `dirty` before it returns, so nothing the person typed can be lost between a
 * keystroke and the timer (a debounced reporter once lost the last keystrokes on a quick exit). The write follows after a
 * short pause, when focus leaves (`flush`), and when the page is left or the window closes (`flush` again, awaited). A text
 * that changes while a write is in flight is written next, never skipped; a failed write keeps the text and the `error`.
 */
export class DebouncedSaver {
  private text: string
  private saved: string
  private state: SaveState = 'clean'
  private errorText: string | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private running: Promise<void> | null = null
  private readonly listeners = new Set<() => void>()
  private snapshot: { state: SaveState; error: string | null }

  constructor(
    initial: string,
    private readonly save: (text: string) => Promise<void>,
    private readonly debounceMs = 400
  ) {
    this.text = initial
    this.saved = initial
    this.snapshot = { state: 'clean', error: null }
  }

  get current(): string {
    return this.text
  }

  /** The text as the editor should show it; `getSnapshot` for `useSyncExternalStore`. */
  getSnapshot = (): { state: SaveState; error: string | null } => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(state: SaveState, error: string | null = null): void {
    this.state = state
    this.errorText = error
    if (this.snapshot.state !== state || this.snapshot.error !== error) {
      this.snapshot = { state, error }
      this.listeners.forEach((l) => l())
    }
  }

  change(text: string): void {
    this.text = text
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (text === this.saved && this.state !== 'saving') {
      this.set('clean')
      return
    }
    if (this.state !== 'saving') this.set('dirty')
    this.timer = setTimeout(() => void this.flush(), this.debounceMs)
  }

  /** Write now what has not been written. Resolves when everything typed so far is saved (or failed). */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.running) this.running = this.drain().finally(() => (this.running = null))
    return this.running
  }

  private async drain(): Promise<void> {
    while (this.text !== this.saved) {
      const sending = this.text
      this.set('saving')
      try {
        await this.save(sending)
        this.saved = sending
      } catch (error) {
        this.set('error', error instanceof Error ? error.message : String(error))
        return
      }
    }
    this.set('clean')
  }

  get error(): string | null {
    return this.errorText
  }
}
