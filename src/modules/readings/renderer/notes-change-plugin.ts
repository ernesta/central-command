import { serializerCtx } from '@milkdown/kit/core'
import { Plugin } from '@milkdown/kit/prose/state'
import { $ctx, $prose } from '@milkdown/kit/utils'

/** Where the editor reports its Markdown. Set by the editor component when it creates the editor. */
export const notesChangeCtx = $ctx<(markdown: string) => void, 'notesChange'>(
  () => undefined,
  'notesChange'
)

/**
 * Reports the note's Markdown synchronously after every change to the document.
 *
 * Milkdown's own change listener is debounced (~200 ms), so leaving the page or closing the
 * window right after typing would lose the last words: the session would never have heard of
 * them. This plugin has no delay; the session does its own (longer) debouncing before saving.
 */
export const notesChangePlugin = $prose((ctx) => {
  // Milkdown's ctx is only valid while the editor is being set up. The view is created after
  // the serializer is ready (earlier it is just a placeholder), so resolve everything there.
  return new Plugin({
    view: () => {
      const serialize = ctx.get(serializerCtx)
      const report = ctx.get(notesChangeCtx.key)
      return {
        update(view, previousState) {
          if (view.state.doc.eq(previousState.doc)) return
          report(serialize(view.state.doc))
        }
      }
    }
  })
})
