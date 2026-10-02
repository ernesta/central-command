import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdownFromCopy } from '@shared/entity-copy'
import { positions } from './live-lines'
import { pastedLinkTarget } from './live-links'

/*
 * Paste is plain text, always (from a web page, from Word, from another note): the text flavour of the clipboard goes in as
 * typed, and the formatting is left behind (the user's call; converting it to Markdown is a possible later addition).
 * A web address pasted over selected text makes the text a link, `[selection](address)`; nothing else changes the text.
 * Cmd-Shift-V reaches the editor as a made-up paste event carrying only text (`shell/usePastePlain.ts`).
 */

/** A label the selection can be inside `[...]`: unbalanced brackets are escaped, or the link would not close. */
function linkLabel(text: string): string {
  let depth = 0
  for (const char of text) {
    if (char === '[') depth += 1
    if (char === ']') depth -= 1
    if (depth < 0) break
  }
  return depth === 0 ? text : text.replace(/([[\]])/g, '\\$1')
}

/**
 * Put `clipboardText` where the selection is. `trusted` is false for the made-up event of Cmd-Shift-V, which is
 * plain on purpose and must not link.
 */
export function pasteText(view: EditorView, clipboardText: string, trusted: boolean): void {
  const { state } = view
  // Windows and old Mac line ends become the ones this note uses; a stray one would be a character in the line.
  const text = clipboardText.replace(/\r\n?|\n/g, state.lineBreak)
  const href = trusted ? pastedLinkTarget(clipboardText) : null
  const oneLine = (from: number, to: number): boolean =>
    from < to && state.doc.lineAt(from).number === state.doc.lineAt(to).number
  const linking = href !== null && state.selection.ranges.every((r) => oneLine(r.from, r.to))
  if (text === '') return
  view.dispatch(
    state.update(
      state.changeByRange((range) => {
        const insert = linking
          ? `[${linkLabel(state.sliceDoc(range.from, range.to))}](${href})`
          : text
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.cursor(range.from + positions(state, insert))
        }
      }),
      { scrollIntoView: true, userEvent: 'input.paste' }
    )
  )
}

export const livePaste = EditorView.domEventHandlers({
  paste(event, view) {
    if (!event.clipboardData) return false
    // A copy from this app carries its Markdown (`live-copy.ts`): chips come back as chips. Cmd-Shift-V has no HTML, so stays plain.
    const own = markdownFromCopy(event.clipboardData.getData('text/html'))
    if (own !== null) pasteText(view, own, false)
    else pasteText(view, event.clipboardData.getData('text/plain'), event.isTrusted)
    // Handled even when there is no text (a picture, say): the browser's own paste would insert formatted content.
    return true
  }
})
