export const FIND_SHORTCUT = 'Mod-f'
/** Opens find with the replace row already shown, the same chord VS Code's inline editor find uses. */
export const REPLACE_TOGGLE_SHORTCUT = 'Mod-Alt-f'
export const REPLACE_ONE_SHORTCUT = 'Mod-Enter'
export const REPLACE_ALL_SHORTCUT = 'Mod-Shift-Enter'

/** A stretch of the editor's document, in that editor's own positions. */
export interface FindMatch {
  from: number
  to: number
}

/**
 * What the find bar needs from an editor, so `useNotesFind` does not know which library the editor is made with
 * (`liveFindTarget`; the same shape as `MentionTarget`).
 */
export interface FindTarget {
  /** Every match of `query`, in document order, none overlapping another. */
  search(query: string): FindMatch[]
  /** Draw the matches, the current one stronger, without touching the document. */
  highlight(matches: readonly FindMatch[], active: number): void
  /** Scroll a match into view; a match that no longer exists is ignored. */
  scrollTo(match: FindMatch | undefined): void
  /** Replace one match's text (one undo step). */
  replace(match: FindMatch, replacement: string): void
  /** Replace every match's text in a single undo step. */
  replaceAll(matches: readonly FindMatch[], replacement: string): void
}

/** Where an editor's Cmd-F reaches the find bar. Set by `useNotesFind` when the editor is created. */
export interface FindBridge {
  isOpen(): boolean
  open(target: FindTarget, showReplace: boolean): void
  /** The editor was just destroyed (a reload from disk, or React StrictMode's throwaway mount): close without
      touching it again. */
  detach(): void
  /**
   * Cmd-Enter and Cmd-Shift-Enter pressed in the editor itself (the bar's fields handle them on their own): does
   * the replacement and returns true when the bar is open with its replace row shown, else false.
   */
  replaceFromEditor(all: boolean): boolean
}

export const noFindBridge: FindBridge = {
  isOpen: () => false,
  open: () => undefined,
  detach: () => undefined,
  replaceFromEditor: () => false
}
