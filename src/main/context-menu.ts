import type { MenuItemConstructorOptions } from 'electron'
import { isSafeExternalUrl } from './urls'

/** What the right-click menu needs to know about where it was opened (the fields of Electron's `context-menu` params it uses). */
export interface ContextMenuParams {
  isEditable: boolean
  selectionText: string
  misspelledWord: string
  dictionarySuggestions: string[]
  linkURL: string
}

export interface ContextMenuActions {
  replaceMisspelling: (word: string) => void
  addToDictionary: (word: string) => void
  openLink: (url: string) => void
  copyLink: (url: string) => void
}

const MAX_SUGGESTIONS = 5

/**
 * The right-click menu: spelling suggestions for a misspelt word, then Cut, Copy, Paste and Select all where the text can be
 * edited, or Copy where text is selected, and links. Nothing at all where there is nothing to do (empty menus are not shown).
 * Undo and Redo are left out: the editor keeps its own history, which the system's undo would bypass.
 */
export function buildContextMenu(
  params: ContextMenuParams,
  actions: ContextMenuActions
): MenuItemConstructorOptions[] {
  const groups: MenuItemConstructorOptions[][] = []

  if (params.isEditable && params.misspelledWord) {
    const word = params.misspelledWord
    const suggestions: MenuItemConstructorOptions[] =
      params.dictionarySuggestions.length > 0
        ? params.dictionarySuggestions.slice(0, MAX_SUGGESTIONS).map((s) => ({
            label: s,
            click: () => actions.replaceMisspelling(s)
          }))
        : [{ label: 'No suggestions', enabled: false }]
    groups.push([
      ...suggestions,
      { label: 'Add to dictionary', click: () => actions.addToDictionary(word) }
    ])
  }

  if (params.linkURL) {
    const url = params.linkURL
    groups.push([
      ...(isSafeExternalUrl(url)
        ? [{ label: 'Open link', click: () => actions.openLink(url) }]
        : []),
      { label: 'Copy link address', click: () => actions.copyLink(url) }
    ])
  }

  if (params.isEditable) {
    groups.push([
      { role: 'cut', enabled: params.selectionText !== '' },
      { role: 'copy', enabled: params.selectionText !== '' },
      { role: 'paste' },
      { role: 'selectAll' }
    ])
  } else if (params.selectionText !== '') {
    groups.push([{ role: 'copy' }])
  }

  return groups.flatMap((group, i) =>
    i === 0 ? group : [{ type: 'separator' as const }, ...group]
  )
}
