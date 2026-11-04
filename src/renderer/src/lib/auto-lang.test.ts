// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { autoLang } from './auto-lang'

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

describe('autoLang', () => {
  it('tags elements whose own text is Arabic-script, as they appear and change, and untags them again', async () => {
    document.body.innerHTML = '<p id="a">سات ۷</p><p id="b">Seven</p>'
    autoLang()
    expect(document.getElementById('a')!.lang).toBe('ur')
    expect(document.getElementById('b')!.hasAttribute('lang')).toBe(false)

    const added = document.body.appendChild(document.createElement('div'))
    added.innerHTML = '<span>چھ ۶</span>'
    await settle()
    expect(added.querySelector('span')!.lang).toBe('ur')

    const b = document.getElementById('b')!
    b.textContent = 'چھ'
    await settle()
    expect(b.lang).toBe('ur')
    b.textContent = 'Six'
    await settle()
    expect(b.hasAttribute('lang')).toBe(false)
  })

  it('tags a text field by its value, and leaves an explicit lang and the editor alone', async () => {
    document.body.innerHTML =
      '<input id="f"><p id="x" lang="en">سات</p><div class="cm-editor"><span id="e">سات</span></div>'
    autoLang()
    const field = document.getElementById('f') as HTMLInputElement
    field.value = 'سات ۷'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    expect(field.lang).toBe('ur')
    field.value = 'seven'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    expect(field.hasAttribute('lang')).toBe(false)
    expect(document.getElementById('x')!.lang).toBe('en')
    expect(document.getElementById('e')!.hasAttribute('lang')).toBe(false)
  })
})
