import { describe, expect, it } from 'vitest'
import { decorationsOf, hiddenText, shownMarkers, stateFor } from './live-test-utils'

const at = (doc: string, needle: string, offset = 0): number => {
  const index = doc.indexOf(needle)
  if (index < 0) throw new Error(`no "${needle}" in the test text`)
  return index + offset
}

describe('headings', () => {
  const doc = '# Title\n\nSome text\n\n### Later heading\n'

  it('hides the marker and its space away from the cursor, and shows them where the cursor is', () => {
    expect(hiddenText(stateFor(doc, at(doc, 'Some')))).toEqual(['# ', '### '])
    const inTitle = stateFor(doc, at(doc, 'Title', 2))
    expect(hiddenText(inTitle)).toEqual(['### '])
    expect(shownMarkers(inTitle)).toEqual(['# '])
  })

  it('styles the heading at every level, revealed or not', () => {
    const kinds = decorationsOf(stateFor(doc, at(doc, 'Some'))).map((seen) => seen.kind)
    expect(kinds).toContain('live-h1')
    expect(kinds).toContain('live-h3')
  })

  it('shows nothing while the editor is not focused', () => {
    expect(hiddenText(stateFor(doc, 2), false)).toEqual(['# ', '### '])
    expect(shownMarkers(stateFor(doc, 2), false)).toEqual([])
  })

  it('treats the closing hashes of a heading like the opening ones', () => {
    const closing = '## Title ##\n\ntext'
    expect(hiddenText(stateFor(closing, at(closing, 'text')))).toEqual(['## ', '##'])
    expect(shownMarkers(stateFor(closing, 3))).toEqual(['## ', '##'])
  })
})

describe('spans', () => {
  const doc = 'Plain **strong** and *soft* and ~~gone~~ and `code` end'

  it('hides every pair away from the cursor', () => {
    expect(hiddenText(stateFor(doc, 0))).toEqual(['**', '**', '*', '*', '~~', '~~', '`', '`'])
  })

  it('shows only the pair the cursor touches', () => {
    expect(shownMarkers(stateFor(doc, at(doc, 'strong', 3)))).toEqual(['**', '**'])
    expect(hiddenText(stateFor(doc, at(doc, 'strong', 3)))).toEqual([
      '*',
      '*',
      '~~',
      '~~',
      '`',
      '`'
    ])
  })

  it('counts the cursor at either edge as touching', () => {
    expect(shownMarkers(stateFor(doc, at(doc, '**strong**')))).toEqual(['**', '**'])
    expect(shownMarkers(stateFor(doc, at(doc, '**strong**', 10)))).toEqual(['**', '**'])
    expect(shownMarkers(stateFor(doc, at(doc, '**strong**', 11)))).toEqual([])
  })

  it('styles the text between the markers', () => {
    const state = stateFor(doc, 0)
    const strong = decorationsOf(state).find((seen) => seen.kind === 'live-strong')
    expect(strong && state.doc.sliceString(strong.from, strong.to)).toBe('strong')
  })

  it('reveals an outer span when the cursor is in an inner one', () => {
    const nested = '**a *b* c**'
    expect(shownMarkers(stateFor(nested, at(nested, 'b')))).toEqual(['**', '**', '*', '*'])
  })
})

describe('links', () => {
  const doc = 'See [the site](https://example.org/a) now'

  it('hides the brackets and the address away from the cursor', () => {
    expect(hiddenText(stateFor(doc, 0))).toEqual(['[', '](https://example.org/a)'])
  })

  it('shows all of it, address in place as text, while the cursor is anywhere in the link', () => {
    for (const cursor of [at(doc, 'the site'), at(doc, 'example', 3), at(doc, '[')]) {
      const state = stateFor(doc, cursor)
      expect(hiddenText(state)).toEqual([])
      expect(shownMarkers(state)).toEqual(['[', '](https://example.org/a)'])
    }
  })

  it('draws the label as a link', () => {
    const state = stateFor(doc, 0)
    const link = decorationsOf(state).find((seen) => seen.kind === 'live-link')
    expect(link && state.doc.sliceString(link.from, link.to)).toBe('the site')
  })

  it('draws an address written out in the text as a link, and hides nothing', () => {
    const bare = 'Go to https://example.org/x now'
    const state = stateFor(bare, 0)
    const link = decorationsOf(state).find((seen) => seen.kind === 'live-link')
    expect(link && state.doc.sliceString(link.from, link.to)).toBe('https://example.org/x')
    expect(hiddenText(state)).toEqual([])
  })

  it('leaves reference links and images as they are', () => {
    const other = '[a][b] and ![alt](pic.png)\n\n[b]: https://example.org'
    expect(hiddenText(stateFor(other, other.length))).toEqual([])
  })

  it('does not hide a link whose label is empty', () => {
    expect(hiddenText(stateFor('x [](https://example.org) y', 0))).toEqual([])
  })
})

describe('quotes and rules', () => {
  it('hides the quote mark away from the cursor and shows it on its lines', () => {
    const doc = 'Before\n\n> quoted\n> more\n\nAfter'
    expect(hiddenText(stateFor(doc, 0))).toEqual(['> ', '> '])
    const inside = stateFor(doc, at(doc, 'quoted'))
    expect(hiddenText(inside)).toEqual([])
    expect(shownMarkers(inside)).toEqual(['> ', '> '])
  })

  it('writes one mark per level for nested quotes, each hidden and shown as typed', () => {
    const doc = '> outer\n>\n> > inner\n\nAfter'
    expect(hiddenText(stateFor(doc, at(doc, 'After')))).toEqual(['> ', '>', '> ', '> '])
    const kinds = decorationsOf(stateFor(doc, at(doc, 'After')))
    expect(kinds.filter((seen) => seen.kind === 'live-quote')).toHaveLength(3)
  })

  it('draws a rule as a line and shows the dashes while the cursor is on it', () => {
    const doc = 'above\n\n---\n\nbelow'
    expect(hiddenText(stateFor(doc, 0))).toEqual(['---'])
    expect(shownMarkers(stateFor(doc, at(doc, '---', 1)))).toEqual(['---'])
  })

  it('does not take the underline of a setext heading for a rule, and hides it like any marker', () => {
    const doc = 'Title\n-----\n\ntext'
    const away = stateFor(doc, at(doc, 'text'))
    expect(hiddenText(away)).toEqual(['-----'])
    expect(decorationsOf(away).some((seen) => seen.kind === 'live-h2')).toBe(true)
    expect(shownMarkers(stateFor(doc, 2))).toEqual(['-----'])
  })
})

describe('a selection across blocks', () => {
  const doc = '# Title\n\nSome **strong** text\n'

  it('shows no markers anywhere', () => {
    const state = stateFor(doc, 2, at(doc, 'text'))
    expect(shownMarkers(state)).toEqual([])
    expect(hiddenText(state)).toEqual(['# ', '**', '**'])
  })

  it('does not count a triple-click (whole line plus its newline) as across blocks', () => {
    const state = stateFor(doc, 0, at(doc, '\n\nSome') + 1)
    expect(shownMarkers(state)).toEqual(['# '])
  })

  it('shows the markers of a selection inside one block', () => {
    const state = stateFor(doc, at(doc, 'Some'), at(doc, 'text', 4))
    expect(shownMarkers(state)).toEqual(['**', '**'])
  })
})

describe('the cursor is never inside hidden text', () => {
  it('for every position of a text with all the constructs', () => {
    const doc = [
      '# Head *em* **st**',
      '',
      'Para with [link](https://a.b/c "t") and `code` and ~~no~~ and https://x.y.',
      '',
      '> quote **bold**',
      '> > deeper [l](u)',
      '',
      '---',
      '',
      '- item **x**',
      '  - nested',
      '',
      '## Two ##',
      ''
    ].join('\n')
    for (let pos = 0; pos <= doc.length; pos += 1) {
      const state = stateFor(doc, pos)
      for (const seen of decorationsOf(state)) {
        if (seen.kind !== 'hidden') continue
        expect(
          seen.from < pos && pos < seen.to,
          `cursor at ${pos} inside hidden ${seen.from}-${seen.to}`
        ).toBe(false)
        expect(state.doc.lineAt(seen.from).number).toBe(state.doc.lineAt(seen.to).number)
      }
    }
  })
})
