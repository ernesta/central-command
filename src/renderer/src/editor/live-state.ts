import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, keymap } from '@codemirror/view'
import { liveLayer } from './live-decorations'
import { liveKeymap } from './live-keymap'
import { linkTargetAt } from './live-links'

export interface LiveOptions {
  /** The note's Markdown, exactly as it is in the file. */
  doc: string
  /** Called synchronously, with the full text, after every change to the document; never for a change nobody made. */
  onChange: (text: string) => void
  /** Cmd-click on a link. */
  openLink: (href: string) => void
  /** Names the editing area for assistive technology. */
  label: string
}

/**
 * Keep the line breaks the file has: CodeMirror otherwise reads `\r\n` and a lone `\r` as line breaks and writes
 * `\n` back (`Text.toString()` always joins with `\n`; `state.sliceDoc()` uses the file's own), which would change every line of such a file on the first edit.
 */
export function lineSeparatorFor(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

/** `Mod-i` is "select parent syntax" in the default keymap; it is italic in this editor (`live-keymap.ts`). */
const keys = defaultKeymap.filter((binding) => binding.key !== 'Mod-i')

export function liveExtensions(options: LiveOptions): Extension[] {
  return [
    EditorState.lineSeparator.of(lineSeparatorFor(options.doc)),
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    liveKeymap,
    keymap.of([...keys, ...historyKeymap]),
    liveLayer,
    EditorView.contentAttributes.of({ 'aria-label': options.label }),
    // Reports the text synchronously on every change: the session saves on its own (longer) timer, so nothing
    // typed just before leaving the page or quitting can be missed.
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.sliceDoc())
    }),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (!(event.metaKey || event.ctrlKey)) return false
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        const href = pos === null ? null : linkTargetAt(view.state, pos)
        if (!href) return false
        event.preventDefault()
        options.openLink(href)
        return true
      }
    })
  ]
}

export function createLiveState(options: LiveOptions): EditorState {
  return EditorState.create({ doc: options.doc, extensions: liveExtensions(options) })
}
