// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { autoDirectionOnFocus } from './auto-direction'

describe('autoDirectionOnFocus', () => {
  it('gives a text field dir=auto when it takes focus, and leaves other fields and a set dir alone', () => {
    autoDirectionOnFocus()
    const text = document.body.appendChild(document.createElement('input'))
    const box = document.body.appendChild(document.createElement('input'))
    box.type = 'checkbox'
    const area = document.body.appendChild(document.createElement('textarea'))
    const fixed = document.body.appendChild(document.createElement('input'))
    fixed.setAttribute('dir', 'ltr')
    for (const el of [text, box, area, fixed])
      el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(text.getAttribute('dir')).toBe('auto')
    expect(area.getAttribute('dir')).toBe('auto')
    expect(box.hasAttribute('dir')).toBe(false)
    expect(fixed.getAttribute('dir')).toBe('ltr')
  })
})
