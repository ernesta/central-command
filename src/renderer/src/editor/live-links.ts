import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { pastedLinkTarget } from '../notes/notes-links'

/**
 * The address of the link at `pos`: the target of `[label](address)` when the position is anywhere in it (label or
 * address), or a web address written out in the text. Null anywhere else. Cmd-click opens it (`LiveEditor`).
 */
export function linkTargetAt(state: EditorState, pos: number): string | null {
  const tree = syntaxTree(state)
  for (const side of [0, -1, 1] as const) {
    for (
      let node = tree.resolveInner(pos, side) as typeof tree.topNode | null;
      node;
      node = node.parent
    ) {
      if (node.name === 'Link') {
        const url = node.getChild('URL')
        if (!url) return null
        return addressOf(state.doc.sliceString(url.from, url.to))
      }
      if (node.name === 'URL') return addressOf(state.doc.sliceString(node.from, node.to))
      if (node.name === 'Paragraph' || node.name === 'Document') break
    }
  }
  return null
}

function addressOf(raw: string): string {
  const value = raw.replace(/^<|>$/g, '')
  return pastedLinkTarget(value) ?? value
}
