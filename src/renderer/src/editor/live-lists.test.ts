// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { openView, press, show } from './live-key-utils'

/** Open `before`, press `chord`, and return the text with the selection written in. */
function after(before: string, chord: string): string {
  const { view } = openView(before)
  press(view, chord)
  return show(view)
}

describe('Enter', () => {
  it('starts the next bullet, of the kind in use', () => {
    expect(after('- a|', 'Enter')).toBe('- a\n- |')
    expect(after('* a|', 'Enter')).toBe('* a\n* |')
    expect(after('+ a|', 'Enter')).toBe('+ a\n+ |')
  })

  it('counts up in a numbered list and renumbers the items below', () => {
    expect(after('1. a|', 'Enter')).toBe('1. a\n2. |')
    expect(after('1. a|\n2. b\n3. c', 'Enter')).toBe('1. a\n2. |\n3. b\n4. c')
    expect(after('1) a|', 'Enter')).toBe('1) a\n2) |')
  })

  it('leaves the numbers below alone when the list did not count up', () => {
    expect(after('1. a|\n1. b', 'Enter')).toBe('1. a\n2. |\n1. b')
  })

  it('starts an unticked checkbox', () => {
    expect(after('- [x] a|', 'Enter')).toBe('- [x] a\n- [ ] |')
  })

  it('stays at the level of a nested item', () => {
    expect(after('- a\n  - b|', 'Enter')).toBe('- a\n  - b\n  - |')
  })

  it('splits an item at the cursor, and replaces a selection', () => {
    expect(after('- ab|cd', 'Enter')).toBe('- ab\n- |cd')
    expect(after('- a|bc|d', 'Enter')).toBe('- a\n- |d')
  })

  it('ends the list on an empty item', () => {
    expect(after('- a\n- |', 'Enter')).toBe('- a\n|')
    expect(after('- [ ] |', 'Enter')).toBe('|')
    expect(after('1. a\n2. |', 'Enter')).toBe('1. a\n|')
  })

  it('moves an empty nested item out a level first', () => {
    expect(after('- a\n  - |', 'Enter')).toBe('- a\n- |')
  })

  it('continues a quote, and leaves it on an empty line however deep', () => {
    expect(after('> a|', 'Enter')).toBe('> a\n> |')
    expect(after('> a\n> |', 'Enter')).toBe('> a\n|')
    expect(after('> > a\n> > |', 'Enter')).toBe('> > a\n|')
    expect(after('> > > |', 'Enter')).toBe('|')
  })

  it('continues a list inside a quote, and ends only the list first', () => {
    expect(after('> - a|', 'Enter')).toBe('> - a\n> - |')
    expect(after('> - a\n> - |', 'Enter')).toBe('> - a\n> |')
  })

  it('is a plain new line after a heading, and keeps the indentation of a plain line', () => {
    expect(after('## t|', 'Enter')).toBe('## t\n|')
    expect(after('ab|cd', 'Enter')).toBe('ab\n|cd')
    expect(after('   ab|', 'Enter')).toBe('   ab\n   |')
  })

  it('does not continue anything inside code', () => {
    expect(after('```\n- x|\n```', 'Enter')).toBe('```\n- x\n|\n```')
    expect(after('```\n> x|\n```', 'Enter')).toBe('```\n> x\n|\n```')
    expect(after('```\n> |\n```', 'Enter')).toBe('```\n> \n|\n```')
  })

  it('opens a line above when the cursor is before the marker', () => {
    expect(after('|- a', 'Enter')).toBe('\n|- a')
  })

  it('reports each change as it happens', () => {
    const { view, reports } = openView('- a|')
    press(view, 'Enter')
    expect(reports).toEqual(['- a\n- '])
  })
})

describe('Shift-Enter', () => {
  it('writes a backslash line break', () => {
    expect(after('ab|cd', 'Shift-Enter')).toBe('ab\\\n|cd')
  })
  it('keeps the text of a list item under its text, and stays in a quote', () => {
    expect(after('- ab|', 'Shift-Enter')).toBe('- ab\\\n  |')
    expect(after('1. ab|', 'Shift-Enter')).toBe('1. ab\\\n   |')
    expect(after('- [ ] ab|', 'Shift-Enter')).toBe('- [ ] ab\\\n  |')
    expect(after('> ab|', 'Shift-Enter')).toBe('> ab\\\n> |')
  })
  it('is a plain new line in a heading', () => {
    expect(after('# ab|', 'Shift-Enter')).toBe('# ab\n|')
  })
})

describe('Tab and Mod-]', () => {
  for (const chord of ['Tab', 'Mod-]']) {
    it(`${chord} nests an item under the one before it`, () => {
      expect(after('- a\n- |b', chord)).toBe('- a\n  - |b')
      expect(after('1. a\n2. |b', chord)).toBe('1. a\n   2. |b')
      expect(after('- [ ] a\n- [ ] |b', chord)).toBe('- [ ] a\n  - [ ] |b')
    })
    it(`${chord} takes the item's children along, and every selected item`, () => {
      expect(after('- a\n- |b\n  - c', chord)).toBe('- a\n  - |b\n    - c')
      expect(after('- a\n- |b\n- c|', chord)).toBe('- a\n  - |b\n  - c|')
    })
    it(`${chord} does nothing on the first item, yet keeps the key`, () => {
      const { view } = openView('- |a')
      expect(press(view, chord)).toBe(true)
      expect(show(view)).toBe('- |a')
    })
  }
  it('Tab leaves other text to the browser', () => {
    expect(press(openView('abc|').view, 'Tab')).toBe(false)
  })
})

describe('Shift-Tab and Mod-[', () => {
  for (const chord of ['Shift-Tab', 'Mod-[']) {
    it(`${chord} moves a nested item out a level`, () => {
      expect(after('- a\n  - |b', chord)).toBe('- a\n- |b')
      expect(after('- a\n    - |b', chord)).toBe('- a\n- |b')
      expect(after('- a\n  - |b\n    - c', chord)).toBe('- a\n- |b\n  - c')
    })
    it(`${chord} leaves a top-level item where it is`, () => {
      const { view } = openView('- |a')
      expect(press(view, chord)).toBe(true)
      expect(show(view)).toBe('- |a')
    })
  }
})

describe('Backspace', () => {
  it('takes the bullet, number or checkbox off as one step', () => {
    expect(after('- |a', 'Backspace')).toBe('|a')
    expect(after('1. |a', 'Backspace')).toBe('|a')
    expect(after('- [ ] |a', 'Backspace')).toBe('|a')
    expect(after('- [x] |a', 'Backspace')).toBe('|a')
    expect(after('* |a', 'Backspace')).toBe('|a')
  })

  it('moves a nested item out a level first, then makes it a paragraph', () => {
    expect(after('- a\n  - |b', 'Backspace')).toBe('- a\n- |b')
    expect(after('- a\n- |b', 'Backspace')).toBe('- a\n\n|b')
  })

  it('leaves a blank line where the paragraph would run into the line above', () => {
    expect(after('- a\n- |b\n- c', 'Backspace')).toBe('- a\n\n|b\n- c')
    expect(after('text\n- |b', 'Backspace')).toBe('text\n\n|b')
    expect(after('# Title\n- |b', 'Backspace')).toBe('# Title\n|b')
    expect(after('text\n\n- |b', 'Backspace')).toBe('text\n\n|b')
  })

  it('keeps a quote round the paragraph it leaves', () => {
    expect(after('> - |a', 'Backspace')).toBe('> |a')
    expect(after('> x\n> - |a', 'Backspace')).toBe('> x\n>\n> |a')
  })

  it('is the ordinary Backspace anywhere else in the item', () => {
    expect(after('- a|', 'Backspace')).toBe('- |')
    expect(after('- ab|c', 'Backspace')).toBe('- a|c')
  })

  it('at the start of the line, before the marker, joins the item onto the line above', () => {
    expect(after('x\n|- a', 'Backspace')).toBe('x|a')
    expect(after('x\n\n|- a', 'Backspace')).toBe('x\n|- a')
  })

  it('is one undo step', async () => {
    const { view } = openView('- |a')
    press(view, 'Backspace')
    expect(show(view)).toBe('|a')
    press(view, 'Mod-z')
    expect(view.state.sliceDoc()).toBe('- a')
  })
})

describe('Delete', () => {
  it('at the end of a line joins the next item on without its marker', () => {
    expect(after('a|\n- b', 'Delete')).toBe('a|b')
    expect(after('- a|\n- b', 'Delete')).toBe('- a|b')
    expect(after('a|\n1. b', 'Delete')).toBe('a|b')
    expect(after('a|\n- [ ] b', 'Delete')).toBe('a|b')
  })
  it('is the ordinary Delete on an empty line, in the middle of a line and before plain text', () => {
    expect(after('|\n- b', 'Delete')).toBe('|- b')
    expect(after('a|b\n- c', 'Delete')).toBe('a|\n- c')
    expect(after('a|\nb', 'Delete')).toBe('a|b')
  })
})

describe('in a note with Windows line ends', () => {
  const crlf = (text: string): string => text.replace(/\n/g, '\r\n')
  /** Put the cursor at the end of `text` (positions count a line end once, so bars cannot mark it). */
  function atEnd(text: string): ReturnType<typeof openView>['view'] {
    const { view } = openView(text)
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    return view
  }

  it('Enter, Shift-Enter and the code block use the note’s own line end, never a bare one', () => {
    const enterView = atEnd(crlf('- a\n- b'))
    press(enterView, 'Enter')
    expect(enterView.state.sliceDoc()).toBe(crlf('- a\n- b\n- '))
    expect(enterView.state.selection.main.head).toBe(enterView.state.doc.length)

    const breakView = atEnd(crlf('x\n- a'))
    press(breakView, 'Shift-Enter')
    expect(breakView.state.sliceDoc()).toBe(crlf('x\n- a\\\n  '))

    const codeView = atEnd(crlf('x\ny'))
    press(codeView, 'Mod-Alt-c')
    expect(codeView.state.sliceDoc()).toBe(crlf('x\n```\ny\n```'))
  })

  it('Backspace’s blank line is a Windows line end too', () => {
    const { view } = openView(crlf('text\n- b'))
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 2 } })
    press(view, 'Backspace')
    expect(view.state.sliceDoc()).toBe(crlf('text\n\nb'))
  })
})
