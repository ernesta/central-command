import type { SaveState } from './notes-session'

/**
 * What the facts line under an editor says about saving. Empty for a note that has never had any text (nothing
 * was saved, so "Saved" would be untrue).
 */
export function saveStatusText(save: SaveState, reloaded: boolean, hasContent = true): string {
  switch (save) {
    case 'saving':
      return 'Saving…'
    case 'dirty':
      return 'Unsaved changes'
    case 'error':
      return 'Couldn’t save'
    case 'clean':
      if (reloaded) return 'Updated from an outside change'
      return hasContent ? 'Saved' : ''
  }
}
