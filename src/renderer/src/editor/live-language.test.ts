// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { liveLanguage } from './live-language'

function tagged(doc: string): string[] {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [liveLanguage] }),
    parent: document.body
  })
  const found = [...view.dom.querySelectorAll('[lang="ur"]')].map((el) => el.textContent ?? '')
  view.destroy()
  return found
}

describe('lang="ur" in the editor', () => {
  it('tags each Arabic-script run with its digits, not the English around it', () => {
    expect(tagged('Six is چھ ۶ and seven is سات ۷, ok')).toEqual(['چھ ۶', 'سات ۷'])
  })
  it('tags nothing in an English line, and a whole Urdu line once', () => {
    expect(tagged('Hello 6 7')).toEqual([])
    expect(tagged('السلام علیکم، آپ کیسے ہیں؟')).toEqual(['السلام علیکم، آپ کیسے ہیں؟'])
  })
})
