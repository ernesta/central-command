import type { Node } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $ctx, $prose } from '@milkdown/kit/utils'
import { matchesShortcut } from '@shared/shortcuts'

export const FIND_SHORTCUT = 'Mod-f'
/** Opens find with the replace row already shown, the same chord VS Code's inline editor find uses. */
export const REPLACE_TOGGLE_SHORTCUT = 'Mod-Alt-f'
export const REPLACE_ONE_SHORTCUT = 'Mod-Enter'
export const REPLACE_ALL_SHORTCUT = 'Mod-Shift-Enter'

export interface FindMatch {
  from: number
  to: number
}

/** Where the editor's Cmd-F reaches the find bar. Set by `useNotesFind` when the editor is created. */
export interface FindBridge {
  isOpen(): boolean
  open(view: EditorView, showReplace: boolean): void
  /** The view was just destroyed (a reload from disk, or React StrictMode's throwaway mount): close without
      touching it again. */
  detach(): void
}

const noBridge: FindBridge = { isOpen: () => false, open: () => undefined, detach: () => undefined }
export const findBridgeCtx = $ctx<FindBridge, 'notesFind'>(noBridge, 'notesFind')

interface FindMeta {
  matches: readonly FindMatch[]
  active: number
}

export const findPluginKey = new PluginKey<DecorationSet>('notes-find')

/**
 * Every case-insensitive match of `query` in `doc`, in document order. A match does not cross a mark
 * boundary (a word split across bold and plain text is not found) or a block boundary: good enough for
 * finding your own words back, not a full-text engine. Because of this, every match found is entirely
 * inside one text node, so replacing it is always a plain, single-node edit — nothing here can need to
 * "cross" a boundary the way a search can fail to.
 */
export function findMatches(doc: Node, query: string): FindMatch[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const matches: FindMatch[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let at = text.indexOf(q)
    while (at !== -1) {
      matches.push({ from: pos + at, to: pos + at + q.length })
      at = text.indexOf(q, at + 1)
    }
  })
  return matches
}

/** Set which matches are highlighted, and which one is the current one, without touching the document. */
export function setFindMatches(
  view: EditorView,
  matches: readonly FindMatch[],
  active: number
): void {
  view.dispatch(view.state.tr.setMeta(findPluginKey, { matches, active } satisfies FindMeta))
}

/** Scrolls the given match into view; does nothing for a match that no longer exists. */
export function scrollToMatch(view: EditorView, match: FindMatch | undefined): void {
  if (!match) return
  const dom = view.domAtPos(match.from).node
  const el = dom instanceof HTMLElement ? dom : dom.parentElement
  el?.scrollIntoView({ block: 'center' })
}

/** Replaces one match's text, in its own marks (bold stays bold), in one transaction. */
export function replaceMatch(view: EditorView, match: FindMatch, replacement: string): void {
  view.dispatch(view.state.tr.insertText(replacement, match.from, match.to))
}

/**
 * Replaces every match's text in a single transaction, so replace-all is one undo step, not one per match.
 * Matches are applied from the end of the document backwards: `insertText`'s positions are read against the
 * transaction's document as it stands so far, and replacing a match only ever changes text after its own
 * start, so every match still earlier in the document keeps the position it was found at.
 */
export function replaceAllMatches(
  view: EditorView,
  matches: readonly FindMatch[],
  replacement: string
): void {
  if (matches.length === 0) return
  const ordered = [...matches].sort((a, b) => b.from - a.from)
  let tr = view.state.tr
  for (const m of ordered) tr = tr.insertText(replacement, m.from, m.to)
  view.dispatch(tr)
}

/**
 * Highlights find matches (`setFindMatches`) and opens the find bar on Cmd-F, or Cmd-Option-F with the
 * replace row already shown (Ctrl elsewhere), read from `findBridgeCtx`. Every note, meeting, training
 * entry, the plan and Readings notes get this for free, since they all share `NotesEditor`.
 */
export const notesFindPlugin = $prose((ctx) => {
  let bridge: FindBridge = noBridge
  return new Plugin({
    key: findPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, value) {
        const meta = tr.getMeta(findPluginKey) as FindMeta | undefined
        if (meta) {
          return DecorationSet.create(
            tr.doc,
            meta.matches.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                class: i === meta.active ? 'notes-find-active' : 'notes-find-match'
              })
            )
          )
        }
        return value.map(tr.mapping, tr.doc)
      }
    },
    props: {
      decorations(state) {
        return findPluginKey.getState(state)
      },
      handleKeyDown(view, event) {
        if (bridge.isOpen()) return false
        if (matchesShortcut(event, REPLACE_TOGGLE_SHORTCUT)) {
          event.preventDefault()
          bridge.open(view, true)
          return true
        }
        if (!matchesShortcut(event, FIND_SHORTCUT)) return false
        event.preventDefault()
        bridge.open(view, false)
        return true
      }
    },
    view: () => {
      // Milkdown's ctx is only valid while the editor is being set up; resolve the bridge once the view exists.
      bridge = ctx.get(findBridgeCtx.key)
      // The bridge (and the React state behind it) can outlive this one view: a reload from disk, or React
      // StrictMode's throwaway first mount, destroys the view without going through the bar's own Close.
      return { destroy: () => bridge.detach() }
    }
  })
})
