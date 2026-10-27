const KEY_BUFFER_MS = 700

/**
 * What an open picker remembers between key presses and pointer moves: whether the arrows, the pointer or the typing
 * have moved the highlight (Tab takes the highlighted row only then), where the pointer last was, and the letters typed
 * on a list with no search field. Held in state, not refs, so the render never reads it.
 */
export class PickerInput {
  private movedAlready = false
  private x = -1
  private y = -1
  private pointerAt = -1
  private typed: string
  private at: number

  constructor(seed: string) {
    this.typed = seed
    this.at = Date.now()
  }

  get moved(): boolean {
    return this.movedAlready
  }

  /** Typing starts over: the arrows have not moved the highlight yet. */
  reset(): void {
    this.movedAlready = false
  }

  markMoved(): void {
    this.movedAlready = true
  }

  /** A pointer move to a new place (a list that scrolls under a still pointer reports the same place). */
  pointerMoved(x: number, y: number): boolean {
    if (x === this.x && y === this.y) return false
    this.x = x
    this.y = y
    this.movedAlready = true
    return true
  }

  /** The pointer put the highlight on this row, which is already in view: scrolling to it would make the list jump. */
  highlightedByPointer(index: number): void {
    this.pointerAt = index
  }

  /** Whether the highlight just arrived by the pointer (asking forgets it, so the next arrow key scrolls). */
  takePointerHighlight(index: number): boolean {
    const was = this.pointerAt === index
    this.pointerAt = -1
    return was
  }

  /** Whether letters are being typed (a pause forgets them). */
  get typing(): boolean {
    return this.typed !== '' && Date.now() - this.at < KEY_BUFFER_MS
  }

  /** One more letter on the list with no search field: all the letters typed lately. */
  letter(key: string): string {
    this.typed = (this.typing ? this.typed : '') + key
    this.at = Date.now()
    return this.typed
  }
}
