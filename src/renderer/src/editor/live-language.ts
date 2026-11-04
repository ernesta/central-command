import { type Extension, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { arabicScriptRuns } from '@shared/text-direction'

/*
 * Arabic-script text is tagged `lang="ur"`: the Urdu forms of 4, 6 and 7 come from the font's language feature, and the
 * browser's spell checker and hyphenation follow the tag. Only the run is tagged (not its line), so an English word in the
 * same line keeps the page's language. The app has no way yet to tell Urdu from Arabic or Persian: see `docs/ROADMAP.md`.
 */
const urdu = Decoration.mark({ attributes: { lang: 'ur' } })

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  let last = -1
  for (const range of view.visibleRanges) {
    for (let pos = range.from; pos <= range.to;) {
      const line = doc.lineAt(pos)
      pos = line.to + 1
      if (line.from <= last) continue
      last = line.from
      for (const run of arabicScriptRuns(line.text))
        builder.add(line.from + run.from, line.from + run.to, urdu)
    }
  }
  return builder.finish()
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) this.decorations = build(update.view)
    }
  },
  { decorations: (value) => value.decorations }
)

export const liveLanguage: Extension = plugin
