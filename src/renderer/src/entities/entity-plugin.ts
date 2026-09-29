import type { EditorState } from '@milkdown/kit/prose/state'
import { Plugin } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import { linkSchema } from '@milkdown/kit/preset/commonmark'
import { $ctx, $prose } from '@milkdown/kit/utils'
import { parseEntityHref, type EntityRef } from '@shared/entities'
import type { Resolved } from './resolver'

/** The `@…` being typed: where it starts (the `@`), where the cursor is, and what follows the `@`. */
export interface Suggestion {
  from: number
  to: number
  query: string
}

/**
 * Everything the editor plugins need from the outside world: what a mention points at, and the picker that
 * opens on `@`. Set by `NotesEditor` when it makes the editor (a controller object, not React state, so the
 * plugins never see a stale closure: the same shape as the find bar's bridge).
 */
export interface EntityHost {
  resolve(ref: EntityRef): Resolved
  /** The text before the cursor now ends in an `@…` (or no longer does: null). */
  suggest(view: EditorView, suggestion: Suggestion | null): void
  /** A key went down while the picker may be open; true when the picker took it. */
  handleKey(event: KeyboardEvent): boolean
  /** The view is gone (a reload from disk, or React StrictMode's throwaway first mount). */
  detach(): void
}

const noHost: EntityHost = {
  resolve: () => ({ state: 'pending' }),
  suggest: () => undefined,
  handleKey: () => false,
  detach: () => undefined
}
export const entityHostCtx = $ctx<EntityHost, 'entityHost'>(noHost, 'entityHost')

/**
 * The editor draws a link's address into the page only when its scheme is one browsers open (`http:`, `mailto:`…) and
 * leaves the `href` empty otherwise, so a mention would not be an address at all in the page. The mention's own scheme
 * is drawn as it is: it is never followed as a link (a click is handled by `NotesEditor`), only read.
 */
export const entityLinkSchema = linkSchema.extendSchema((previous) => (ctx) => {
  const spec = previous(ctx)
  return {
    ...spec,
    toDOM: (mark, inline) => {
      const out = spec.toDOM?.(mark, inline)
      if (!Array.isArray(out) || !parseEntityHref(String(mark.attrs.href ?? '')))
        return out as never
      const [tag, attrs, ...rest] = out as [string, Record<string, unknown>, ...unknown[]]
      return [tag, { ...attrs, href: mark.attrs.href }, ...rest] as never
    }
  }
})

/** A transaction with this meta changes nothing in the text; it only makes the mentions be drawn again. */
export const ENTITY_REFRESH = 'entity-refresh'

export function refreshMentions(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(ENTITY_REFRESH, true).setMeta('addToHistory', false))
}

const MAX_QUERY = 30
// An `@` that starts a word (after a space, an opening bracket or the start of the block), then a query whose first
// character is not a space, so "meet @ noon" is only a sentence.
const TRIGGER = /(?:^|[\s([{"“‘])@([^\s@][^@\n]*)?$/

/**
 * The `@…` the cursor is at the end of, or null. Not in code, not inside a link, and not once the query has run on
 * (more than a short phrase, or two spaces in a row) or the cursor is not a plain caret.
 */
export function findSuggestion(state: EditorState): Suggestion | null {
  const { selection } = state
  if (!selection.empty) return null
  const { $from } = selection
  const parent = $from.parent
  if (!parent.isTextblock || parent.type.spec.code) return null
  // At the very end of a code span or link the caret is at the edge of the mark, so look at the text just before it too.
  const marks = [...$from.marks(), ...($from.nodeBefore?.marks ?? [])]
  const inMark = marks.some((m) => m.type.name === 'inlineCode' || m.type.name === 'link')
  if (inMark) return null
  const before = parent.textBetween(0, $from.parentOffset, undefined, '￼')
  const match = TRIGGER.exec(before)
  if (!match) return null
  const query = match[1] ?? ''
  if (query.length > MAX_QUERY || /\s\s/.test(query)) return null
  const at = before.length - query.length - 1
  return { from: $from.start() + at, to: $from.pos, query }
}

/** Every mention in the text is drawn as a chip of its kind, and struck through when what it points at is gone. */
export const entityMentionPlugin = $prose((ctx) => {
  const host = ctx.get(entityHostCtx.key)
  return new Plugin({
    props: {
      decorations(state) {
        const found: Decoration[] = []
        state.doc.descendants((node, pos) => {
          if (!node.isText) return
          const link = node.marks.find((m) => m.type.name === 'link')
          const ref = link ? parseEntityHref(String(link.attrs.href ?? '')) : null
          if (!ref) return
          const resolved = host.resolve(ref)
          found.push(
            Decoration.inline(pos, pos + node.nodeSize, {
              class: resolved.state === 'missing' ? 'entity entity-missing' : 'entity',
              'data-kind': ref.kind,
              'data-key': ref.key,
              // A name or a citation is not a misspelling.
              spellcheck: 'false',
              style: `--entity-icon: var(--entity-icon-${ref.kind})`
            })
          )
        })
        return DecorationSet.create(state.doc, found)
      }
    }
  })
})

/** Opens the picker when `@` is typed, and hands it the arrow, Enter, Tab and Escape keys while it is open. */
export const entitySuggestPlugin = $prose((ctx) => {
  const host = ctx.get(entityHostCtx.key)
  return new Plugin({
    props: {
      handleKeyDown: (_view, event) => host.handleKey(event)
    },
    view: (view) => {
      host.suggest(view, findSuggestion(view.state))
      return {
        update: (updated) => host.suggest(updated, findSuggestion(updated.state)),
        destroy: () => host.detach()
      }
    }
  })
})
