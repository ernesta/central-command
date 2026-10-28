// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { escapeLeavesFullScreen, listenForEscape } from './useEscapeFullScreen'

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

describe('listenForEscape', () => {
  const form = (): { input: HTMLInputElement; left: () => number; stop: () => void } => {
    document.body.innerHTML = '<div id="form"><input id="task"></div>'
    const input = document.getElementById('task') as HTMLInputElement
    input.focus()
    let count = 0
    const stop = listenForEscape(window, () => count++)
    return { input, left: () => count, stop }
  }
  const escape = (target: Element): void => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  }

  it('stays when a handler closes the form and unmounts the focused field', () => {
    const { input, left, stop } = form()
    document.getElementById('form')!.addEventListener('keydown', () => {
      document.getElementById('form')!.remove()
    })
    escape(input)
    expect(document.activeElement).toBe(document.body)
    expect(left()).toBe(0)
    stop()
  })

  it('stays when a handler closes the list that was open', () => {
    const { left, stop } = form()
    document.body.insertAdjacentHTML('beforeend', '<ul role="listbox" id="list"></ul>')
    document.getElementById('form')!.insertAdjacentHTML('beforeend', '<button id="b">')
    const input = document.getElementById('b') as HTMLButtonElement
    input.focus()
    document.getElementById('form')!.addEventListener('keydown', () => {
      document.getElementById('list')!.remove()
    })
    escape(input)
    expect(left()).toBe(0)
    stop()
  })

  it('leaves when nothing had focus or wanted the key', () => {
    const { left, stop } = form()
    document.body.innerHTML = ''
    escape(document.body)
    expect(left()).toBe(1)
    stop()
  })

  it('stops listening when cleaned up', () => {
    const { left, stop } = form()
    stop()
    document.body.innerHTML = ''
    escape(document.body)
    expect(left()).toBe(0)
  })
})
