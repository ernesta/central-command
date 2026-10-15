// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { EditorView } from '@codemirror/view'
import { openView, press, show } from './live-key-utils'

/** Open `before`, press `chord`, and return the text with the selection written in. */
function after(before: string, chord: string): string {
  const { view } = openView(before)
  press(view, chord)
  return show(view)
}

describe('Enter', () => {
  it('at the start of a paragraph puts an empty line above and stays on it, so each press shows', () => {
    expect(after('## H\n|text', 'Enter')).toBe('## H\n|\ntext')
    expect(after('## H\n|\ntext', 'Enter')).toBe('## H\n\n|\ntext')
  })

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
    it(`${chord} nests the first item of a list started by another bullet character`, () => {
      expect(after('* a\n  * b\n- |c', chord)).toBe('* a\n  * b\n  * |c')
      expect(after('* a\n- |b\n- c', chord)).toBe('* a\n  - |b\n- c')
    })
    it(`${chord} takes the bullet character of the list it joins`, () => {
      expect(after('* a\n  * b\n- |c', chord)).toBe('* a\n  * b\n  * |c')
      expect(after('- a\n  - b\n* |c', chord)).toBe('- a\n  - b\n  - |c')
      expect(after('- a\n- |b', chord)).toBe('- a\n  - |b')
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
    it(`${chord} takes the bullet character of the list it joins`, () => {
      expect(after('* a\n  - |b', chord)).toBe('* a\n* |b')
      expect(after('- [ ] a\n  * [ ] |b', chord)).toBe('- [ ] a\n- [ ] |b')
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

describe('Backspace on empty lines', () => {
  it('takes the empty lines above in one go, keeping one', () => {
    expect(after('a\n\n\n|\nb', 'Backspace')).toBe('a\n|\nb')
    expect(after('a\n\n|\n\nb', 'Backspace')).toBe('a\n|\n\nb')
  })
  it('is the ordinary Backspace under text', () => {
    expect(after('a\n|', 'Backspace')).toBe('a|')
  })
})

describe('text beside a run of empty lines', () => {
  it('Backspace at the start of text collapses the run above to one empty line', () => {
    expect(after('a\n\n\n|b', 'Backspace')).toBe('a\n\n|b')
    expect(after('a\n\n\n\n|- b', 'Backspace')).toBe('a\n\n|- b')
  })
  it('Delete at the end of text collapses the run below to one empty line', () => {
    expect(after('a|\n\n\nb', 'Delete')).toBe('a|\n\nb')
  })
  it('leaves a single empty line to the ordinary key', () => {
    expect(after('a\n\n|b', 'Backspace')).toBe('a\n|b')
    expect(after('a|\n\nb', 'Delete')).toBe('a|\nb')
  })
})

describe('Delete', () => {
  it('takes a whole run of empty lines at once, since they draw no height', () => {
    expect(after('a\n\n|\n\nb', 'Delete')).toBe('a\n\n|b')
    expect(after('a\n|\n \n\n- b', 'Delete')).toBe('a\n|- b')
    expect(after('a\n|\n\n', 'Delete')).toBe('a\n|')
  })
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

describe('a loosely typed checkbox', () => {
  /** Type a space where the cursor is, the way the browser does: through the editor's input handlers. */
  function typeSpace(before: string): string {
    const { view } = openView(before)
    const pos = view.state.selection.main.head
    const handled = view.state
      .facet(EditorView.inputHandler)
      .some((f) =>
        f(view, pos, pos, ' ', () => view.state.update({ changes: { from: pos, insert: ' ' } }))
      )
    if (!handled)
      view.dispatch({ changes: { from: pos, insert: ' ' }, selection: { anchor: pos + 1 } })
    return show(view)
  }

  it('turns [] at the start of a line into a checkbox', () => {
    expect(typeSpace('[]|')).toBe('- [ ] |')
    expect(typeSpace('[ ]|')).toBe('- [ ] |')
    expect(typeSpace('[x]|')).toBe('- [x] |')
    expect(typeSpace('  []|')).toBe('  - [ ] |')
    expect(typeSpace('> []|')).toBe('> - [ ] |')
  })

  it('keeps a bullet or number already typed', () => {
    expect(typeSpace('- []|')).toBe('- [ ] |')
    expect(typeSpace('* [x]|')).toBe('* [x] |')
    expect(typeSpace('1. []|')).toBe('1. [ ] |')
  })

  it('does not double the space of a line that goes on', () => {
    expect(typeSpace('[ ]| Prepare')).toBe('- [ ] |Prepare')
  })

  it('leaves [] elsewhere alone', () => {
    expect(typeSpace('see []|')).toBe('see [] |')
    expect(typeSpace('```\n[]|\n```')).toBe('```\n[] |\n```')
  })
})
