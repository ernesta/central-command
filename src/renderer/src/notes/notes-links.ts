import { InputRule } from '@milkdown/kit/prose/inputrules'
import { Plugin } from '@milkdown/kit/prose/state'
import { $inputRule, $prose } from '@milkdown/kit/utils'

/**
 * The address to link to when this pasted text is nothing but one web address (or email link), else null.
 * "www.example.org" gets https:// in front, so the link opens rather than being taken for a relative one.
 */
export function pastedLinkTarget(text: string): string | null {
  const value = text.trim()
  if (/^(https?:\/\/|mailto:)\S+$/i.test(value)) return value
  if (/^www\.\S+\.\S+$/i.test(value)) return `https://${value}`
  return null
}

/**
 * Typing `[text](address)` turns it into a link the moment the closing bracket goes in, the way the same text
 * reads in the file. Not for images (`![alt](src)`), which the editor does not draw.
 */
export const markdownLinkRule = $inputRule(
  () =>
    new InputRule(/(?<!!)\[([^\]\n]+)\]\(([^)\s]+)\)$/, (state, match, start, end) => {
      const type = state.schema.marks.link
      const [, label, href] = match
      if (!type || !state.doc.resolve(start).parent.type.allowsMarkType(type)) return null
      return state.tr
        .replaceWith(start, end, state.schema.text(label, [type.create({ href })]))
        .removeStoredMark(type)
    })
)

/**
 * Pasting a web address while text is selected links that text to it (as in Slack) instead of replacing the
 * text with the address. Anything else pastes as usual, and so does a plain paste (no clipboard data attached).
 */
export const pasteOverSelectionLink = $prose(
  () =>
    new Plugin({
      props: {
        handlePaste(view, event) {
          // Only a real paste: the plain paste (Cmd-Shift-V) is sent to the editor as a made-up event, and must not link.
          if (!event.isTrusted) return false
          const href = pastedLinkTarget(event.clipboardData?.getData('text/plain') ?? '')
          const { selection, schema } = view.state
          const type = schema.marks.link
          if (!href || !type || selection.empty) return false
          const { $from, $to, from, to } = selection
          if (!$from.sameParent($to) || !$from.parent.inlineContent) return false
          if (!$from.parent.type.allowsMarkType(type)) return false
          view.dispatch(
            view.state.tr.removeMark(from, to, type).addMark(from, to, type.create({ href }))
          )
          return true
        }
      }
    })
)
