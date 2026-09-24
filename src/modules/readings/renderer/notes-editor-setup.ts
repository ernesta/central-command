import { Editor, remarkStringifyOptionsCtx } from '@milkdown/kit/core'
import { history } from '@milkdown/kit/plugin/history'
import { listener } from '@milkdown/kit/plugin/listener'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'

/**
 * How Markdown is written back to the file. Chosen so notes look the way a person
 * (or Claude Code) would write them: dash bullets, `---` rules, `*` emphasis.
 */
export const NOTES_STRINGIFY_OPTIONS = {
  bullet: '-',
  rule: '-',
  emphasis: '*',
  strong: '*',
  fence: '`',
  listItemIndent: 'one'
} as const

/**
 * The plugins every notes editor uses: CommonMark plus GitHub-flavoured Markdown
 * (task lists, tables, strikethrough), undo history, and change listening. Shared by
 * the real editor and its tests so they cannot drift apart.
 */
export function withNotesPlugins(editor: Editor): Editor {
  return editor
    .config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (options) => ({
        ...options,
        ...NOTES_STRINGIFY_OPTIONS
      }))
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
}
