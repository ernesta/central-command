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
 * A web address typed out in full becomes a link when the space after it goes in, so no address in a note is
 * ever plain text you cannot click. Trailing punctuation ("see https://example.org.") stays outside the link.
 */
export const typedAddressRule = $inputRule(
  () =>
    new InputRule(
      /(?<![\w/@.])((?:https?:\/\/|www\.)[^\s<>]+?)([.,;:!?)\]]*)\s$/i,
      (state, match, start, end) => {
        const type = state.schema.marks.link
        const [, address, trailing] = match
        const href = pastedLinkTarget(address)
        if (!type || !href || !state.doc.resolve(start).parent.type.allowsMarkType(type))
          return null
        const code = state.schema.marks.inlineCode
        if (state.doc.rangeHasMark(start, start + address.length, type)) return null
        if (code && state.doc.rangeHasMark(start, start + address.length, code)) return null
        return state.tr
          .replaceWith(start, end, [
            state.schema.text(address, [type.create({ href })]),
            state.schema.text(`${trailing} `)
          ])
          .removeStoredMark(type)
      }
    )
)

/**
 * Pasting a web address while text is selected links that text to it (as in Slack) instead of replacing the
 * text with the address; pasting one with nothing selected inserts it as a link. Anything else pastes as usual,
 * and so does a plain paste (no clipboard data attached).
 */
export const pasteOverSelectionLink = $prose(
  () =>
    new Plugin({
      props: {
        handlePaste(view, event) {
          // Only a real paste: the plain paste (Cmd-Shift-V) is sent to the editor as a made-up event, and must not link.
          if (!event.isTrusted) return false
          const pasted = event.clipboardData?.getData('text/plain') ?? ''
          const href = pastedLinkTarget(pasted)
          const { selection, schema } = view.state
          const type = schema.marks.link
          if (!href || !type) return false
          if (selection.empty) {
            if (!selection.$from.parent.type.allowsMarkType(type)) return false
            view.dispatch(
              view.state.tr
                .replaceSelectionWith(schema.text(pasted.trim(), [type.create({ href })]), false)
                .removeStoredMark(type)
            )
            return true
          }
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
