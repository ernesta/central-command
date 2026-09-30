// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { liveDecorations } from './live-decorations'
import { openView } from './live-key-utils'

/** What the view draws right now: the text hidden, and the text shown as a marker. */
function drawn(view: EditorView): { hidden: string[]; shown: string[] } {
  const set = view.plugin(liveDecorations)!.decorations
  const hidden: string[] = []
  const shown: string[] = []
  set.between(0, view.state.doc.length, (from, to, value) => {
    const text = view.state.sliceDoc(from, to)
    if (value.point && !value.spec.class && !value.spec.widget) hidden.push(text)
    if ((value.spec as { class?: string }).class === 'live-marker') shown.push(text)
  })
  return { hidden, shown }
}

/** jsdom has no focus of its own to report: say the editor has it, as it does while typing. */
function focused(view: EditorView): void {
  vi.spyOn(view, 'hasFocus', 'get').mockReturnValue(true)
  view.dispatch({ selection: view.state.selection })
}

const start = (view: EditorView): void => {
  view.contentDOM.dispatchEvent(new Event('compositionstart', { bubbles: true }))
}
const end = (view: EditorView): void => {
  view.contentDOM.dispatchEvent(new Event('compositionend', { bubbles: true }))
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('an input method composing (dead key, Japanese, Chinese, Korean)', () => {
  const doc = '# Title\n\nplain **bold** text'

  it('shows and hides nothing while the composition lasts, then draws what the cursor says', () => {
    vi.useFakeTimers()
    const { view } = openView(doc + '|')
    focused(view)
    expect(drawn(view).hidden).toEqual(['# ', '**', '**'])
    const before = drawn(view)
    start(view)
    expect(view.compositionStarted).toBe(true)
    // The cursor goes into the heading and into the bold span mid-composition: no marker may appear.
    view.dispatch({ selection: { anchor: 4 } })
    expect(drawn(view)).toEqual(before)
    view.dispatch({ selection: { anchor: doc.indexOf('bold') + 1 } })
    expect(drawn(view)).toEqual(before)
    end(view)
    vi.advanceTimersByTime(200)
    // After it the ordinary rules apply: the cursor is in the bold span, so its markers show and the heading's are gone.
    expect(drawn(view).shown).toEqual(['**', '**'])
    expect(drawn(view).hidden).toEqual(['# '])
  })

  it('keeps hidden markers where they belong while text is typed into the composition', () => {
    vi.useFakeTimers()
    const { view } = openView('# Title\n\nab|')
    focused(view)
    const hiddenBefore = drawn(view).hidden
    start(view)
    view.dispatch({ changes: { from: 0, insert: 'xyz' } })
    // The heading's marker moved along with the text in front of it, and nothing new was drawn or hidden.
    expect(drawn(view).hidden).toEqual(hiddenBefore)
    const set = view.plugin(liveDecorations)!.decorations
    const at: number[] = []
    set.between(0, view.state.doc.length, (from, to, value) => {
      if (value.point && !value.spec.class && !value.spec.widget) at.push(from, to)
    })
    expect(view.state.sliceDoc(at[0], at[1])).toBe('# ')
    end(view)
    vi.advanceTimersByTime(200)
  })

  it('redraws after the composition ends even when no other update follows', () => {
    vi.useFakeTimers()
    const { view } = openView(doc + '|')
    focused(view)
    start(view)
    view.dispatch({ selection: { anchor: 3 } })
    expect(drawn(view).shown).toEqual([])
    end(view)
    vi.advanceTimersByTime(200)
    expect(drawn(view).shown).toEqual(['# '])
  })

  it('does not redraw while still composing when the timer fires early (a second composition began)', () => {
    vi.useFakeTimers()
    const { view } = openView(doc + '|')
    focused(view)
    start(view)
    end(view)
    start(view)
    view.dispatch({ selection: { anchor: 3 } })
    vi.advanceTimersByTime(200)
    expect(drawn(view).shown).toEqual([])
    end(view)
    vi.advanceTimersByTime(200)
    expect(drawn(view).shown).toEqual(['# '])
  })
})
