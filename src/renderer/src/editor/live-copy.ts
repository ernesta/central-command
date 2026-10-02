import { EditorView } from '@codemirror/view'
import { findMentions } from '@shared/entities'
import { readableCopy, type CopyPart } from '@shared/entity-copy'
import { copyRichText } from '../lib/clipboard'
import { entitiesFacet } from './live-entities'

/*
 * Copy and cut. A selection with no mention copies as the editor always did. One with mentions puts readable text on the
 * clipboard (names, in-text citations and a reference list; meetings and notes by their label) and, in the HTML flavour,
 * the Markdown it came from, so pasting back into the app gives the chips again (`live-paste.ts`). The clipboard first gets
 * the labels at once, then the fuller text once the readings have been looked up.
 */

function selectedMarkdown(view: EditorView): string | null {
  const { state } = view
  if (state.selection.ranges.every((r) => r.empty)) return null
  return state.selection.ranges
    .filter((r) => !r.empty)
    .map((r) => state.sliceDoc(r.from, r.to))
    .join(state.lineBreak)
}

function copySelection(event: ClipboardEvent, view: EditorView, cut: boolean): boolean {
  const markdown = selectedMarkdown(view)
  if (markdown === null || !event.clipboardData) return false
  const mentions = findMentions(markdown)
  if (mentions.length === 0) return false

  const { host } = view.state.facet(entitiesFacet)
  const quick = readableCopy(markdown, () => null)
  event.preventDefault()
  event.clipboardData.setData('text/plain', quick.text)
  event.clipboardData.setData('text/html', quick.html)
  if (cut) view.dispatch(view.state.replaceSelection(''))

  // The kinds with something to say are looked up now, once each; the answer replaces what was just put on the clipboard.
  const seen = new Map<string, Promise<CopyPart | null>>()
  for (const m of mentions) {
    const id = `${m.ref.kind}/${m.ref.key}`
    if (!seen.has(id)) seen.set(id, host.copyPart(m.ref, m.label.replace(/\\(.)/g, '$1')))
  }
  void Promise.all(seen.values()).then(async (parts) => {
    const byId = new Map([...seen.keys()].map((id, n) => [id, parts[n]] as const))
    // Two mentions of one reading may carry different labels: the label is per mention, the reference is per reading.
    const full = readableCopy(markdown, (ref) => byId.get(`${ref.kind}/${ref.key}`) ?? null)
    if (full.text === quick.text && full.html === quick.html) return
    try {
      await copyRichText(full)
    } catch {
      // The labels are already on the clipboard.
    }
  })
  return true
}

export const liveCopy = EditorView.domEventHandlers({
  copy: (event, view) => copySelection(event, view, false),
  cut: (event, view) => copySelection(event, view, true)
})
