// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { openView, press } from './live-key-utils'
import { decorationsOf, hiddenText, shownMarkers, stateFor } from './live-test-utils'

const doc = 'Intro\n\n```js\nconst a = 1\n\nlet b\n```\n\nAfter\n'
const at = (needle: string, offset = 0): number => doc.indexOf(needle) + offset

describe('a fenced block away from the cursor', () => {
  it('hides the fence lines, language included, and collapses them', () => {
    const state = stateFor(doc, at('Intro'))
    expect(hiddenText(state)).toEqual(['```js', '```'])
    const kinds = decorationsOf(state).map((seen) => seen.kind)
    expect(kinds.filter((kind) => kind === 'live-codeblock live-fence-hidden')).toHaveLength(2)
    expect(kinds.filter((kind) => kind === 'live-codeblock')).toHaveLength(3)
    expect(shownMarkers(state)).toEqual([])
  })

  it('hides the same while the editor is not focused', () => {
    expect(hiddenText(stateFor(doc, at('const')), false)).toEqual(['```js', '```'])
  })

  it('hides tildes, a longer fence and an indented one the same way', () => {
    for (const [sample, fences] of [
      ['~~~\nx\n~~~\n\nend', ['~~~', '~~~']],
      ['````md\n```\nx\n```\n````\n\nend', ['````md', '````']],
      ['  ```py\n  x\n  ```\n\nend', ['```py', '```']]
    ] as const) {
      const state = stateFor(sample, sample.length)
      expect(hiddenText(state), sample).toEqual(fences)
    }
  })

  it('does not change the text', () => {
    expect(stateFor(doc, 0).sliceDoc()).toBe(doc)
  })
})

describe('a fenced block with the cursor in it', () => {
  it('shows both fence lines in the marker colour, wherever in the block the cursor is', () => {
    for (const pos of [
      at('```js'),
      at('```js', 3),
      at('```js', 5),
      at('const'),
      at('let b', 5),
      at('\n```\n', 1),
      at('\n```\n', 4)
    ]) {
      const state = stateFor(doc, pos)
      expect(hiddenText(state), `@${pos}`).toEqual([])
      expect(shownMarkers(state), `@${pos}`).toEqual(['```js', '```'])
      expect(
        decorationsOf(state).filter((seen) => seen.kind === 'live-codeblock live-fence-hidden'),
        `@${pos}`
      ).toEqual([])
    }
  })

  it('hides them again when the cursor is on the blank line either side', () => {
    expect(hiddenText(stateFor(doc, at('```js') - 1))).toEqual(['```js', '```'])
    expect(hiddenText(stateFor(doc, at('After') - 1))).toEqual(['```js', '```'])
  })

  it('hides nothing when the selection is inside the block, and everything when it reaches out', () => {
    expect(hiddenText(stateFor(doc, at('const'), at('let')))).toEqual([])
    expect(hiddenText(stateFor(doc, at('Intro'), at('After')))).toEqual(['```js', '```'])
  })
})

describe('a fence that is never closed', () => {
  it('keeps its opening line showing, since everything after it is code', () => {
    const open = 'Intro\n\n```js\nconst a = 1\n'
    const state = stateFor(open, 0)
    expect(hiddenText(state)).toEqual([])
    expect(shownMarkers(state)).toEqual(['```js'])
  })
})

describe('fences in other places', () => {
  it('hides the fence of a block in a list item or quote, keeping what is in front of it', () => {
    const listed = '- item\n\n  ```\n  x\n  ```\n\nend'
    expect(hiddenText(stateFor(listed, listed.length))).toEqual(['```', '```'])
    const quoted = '> ```\n> x\n> ```\n\nend'
    expect(hiddenText(stateFor(quoted, quoted.length)).filter((text) => text !== '> ')).toEqual([
      '```',
      '```'
    ])
  })

  it('leaves an indented code block alone', () => {
    const indented = 'Intro\n\n    code\n\nend'
    expect(hiddenText(stateFor(indented, indented.length))).toEqual([])
    expect(decorationsOf(stateFor(indented, 0)).some((s) => s.kind === 'live-codeblock')).toBe(true)
  })

  it('does not treat backticks inside a paragraph as a fence', () => {
    const inline = 'Use ```not a fence``` here\n'
    expect(hiddenText(stateFor(inline, inline.length)).join('')).not.toContain('```not')
  })
})

describe('hidden text in fences', () => {
  const samples = [
    doc,
    '~~~\nx\n~~~',
    '```\n```',
    '```\n\n```\n\n```ts\nx\n```',
    '- a\n\n  ```\n  x\n  ```\n',
    '> ```\n> x\n> ```\n',
    '```js\r\nx\r\n```\r\n\r\nend',
    '````\n```\nx\n```\n````\n'
  ]

  it('never has the cursor inside it and never crosses a line', () => {
    for (const sample of samples)
      for (let pos = 0; pos <= stateFor(sample).doc.length; pos++) {
        const state = stateFor(sample, pos)
        for (const seen of decorationsOf(state)) {
          if (seen.kind !== 'hidden') continue
          expect(seen.from < pos && pos < seen.to, `${JSON.stringify(sample)} @${pos}`).toBe(false)
          expect(state.doc.lineAt(seen.from).number).toBe(state.doc.lineAt(seen.to).number)
        }
      }
  })
})

describe('Cmd-Option-C', () => {
  it('wraps the line in a fence, which shows because the cursor is in the block, and takes it off again', () => {
    const { view, reports } = openView('a\n\nsome cod|e\n\nb')
    expect(press(view, 'Mod-Alt-c')).toBe(true)
    expect(reports.at(-1)).toBe('a\n\n```\nsome code\n```\n\nb')
    const head = view.state.selection.main.head
    const wrapped = stateFor(view.state.sliceDoc(), head)
    expect(shownMarkers(wrapped)).toEqual(['```', '```'])
    expect(hiddenText(wrapped)).toEqual([])
    expect(press(view, 'Mod-Alt-c')).toBe(true)
    expect(reports.at(-1)).toBe('a\n\nsome code\n\nb')
  })
})
