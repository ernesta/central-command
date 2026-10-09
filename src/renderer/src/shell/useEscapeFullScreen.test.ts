// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { escapeLeavesFullScreen } from './useEscapeFullScreen'

const press = (init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, ...init })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('escapeLeavesFullScreen', () => {
  it('leaves on a plain Escape with nothing focused', () => {
    expect(escapeLeavesFullScreen(press(), document.body)).toBe(true)
  })

  it('stays when the key was used or has modifiers', () => {
    const used = press()
    used.preventDefault()
    expect(escapeLeavesFullScreen(used, document.body)).toBe(false)
    expect(escapeLeavesFullScreen(press({ metaKey: true }), document.body)).toBe(false)
    expect(escapeLeavesFullScreen(press({ key: 'a' }), document.body)).toBe(false)
  })

  it('stays when the cursor is in a field or an editor', () => {
    document.body.innerHTML =
      '<input id="a"><div class="cm-editor"><div id="b" tabindex="0"></div></div>'
    expect(escapeLeavesFullScreen(press(), document.getElementById('a'))).toBe(false)
    expect(escapeLeavesFullScreen(press(), document.getElementById('b'))).toBe(false)
  })

  it('stays while a menu or popup is open', () => {
    document.body.innerHTML = '<button id="a" aria-expanded="true"></button>'
    expect(escapeLeavesFullScreen(press(), document.getElementById('a'))).toBe(false)
    document.body.innerHTML = '<div role="menu"></div><button id="b"></button>'
    expect(escapeLeavesFullScreen(press(), document.getElementById('b'))).toBe(false)
  })
})
