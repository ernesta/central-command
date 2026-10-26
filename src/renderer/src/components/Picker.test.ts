// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Picker, type PickerAdd } from './Picker'
import type { PickerOption } from './picker-match'
import { Held, click, mount, moveMouse, press, typeText, type Mounted } from './picker-test-utils'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

const opt = (label: string, extra: Partial<PickerOption> = {}): PickerOption => ({
  value: label,
  label,
  ...extra
})
const fruit = ['Apple', 'Banana', 'Blueberry', 'Cherry'].map((l) => opt(l))
const many = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].map((l) =>
  opt(l)
)

interface Shown {
  changes: string[]
  button: () => HTMLButtonElement
  input: () => HTMLInputElement | null
  rows: () => string[]
  activeRow: () => string | undefined
  isOpen: () => boolean
  open: () => void
}

function show(
  options: PickerOption[],
  extra: { add?: PickerAdd; initial?: string; parent?: () => void } = {}
): Shown {
  const changes: string[] = []
  mounted = mount(
    createElement(
      'div',
      { onKeyDown: extra.parent },
      createElement(Held<string>, {
        initial: extra.initial ?? options[0].value,
        render: (value, set) =>
          createElement(Picker<string>, {
            value,
            options,
            label: 'Fruit',
            noun: 'fruit',
            add: extra.add,
            onChange: (v) => {
              changes.push(v)
              set(v)
            }
          })
      })
    )
  )
  const button = (): HTMLButtonElement => document.querySelector('button[aria-label="Fruit"]')!
  const input = (): HTMLInputElement | null => document.querySelector('input[role="combobox"]')
  const rows = (): string[] =>
    [...document.querySelectorAll('[role="option"]')].map((r) => r.textContent ?? '')
  const activeRow = (): string | undefined =>
    document.querySelector('[role="option"][data-active="true"]')?.textContent ?? undefined
  const isOpen = (): boolean => document.querySelector('[role="listbox"]') !== null
  const open = (): void => {
    button().focus()
    click(button())
  }
  return { changes, button, input, rows, activeRow, isOpen, open }
}

describe('Picker, a short list', () => {
  it('opens as a plain list with no search field, on the current value', () => {
    const p = show(fruit, { initial: 'Banana' })
    p.open()
    expect(p.isOpen()).toBe(true)
    expect(p.input()).toBeNull()
    expect(p.rows()).toEqual(['Apple', 'Banana', 'Blueberry', 'Cherry'])
    expect(p.activeRow()).toBe('Banana')
  })

  it('walks with the arrows and takes with Enter', () => {
    const p = show(fruit)
    p.open()
    press('ArrowDown')
    press('ArrowDown')
    press('Enter')
    expect(p.changes).toEqual(['Blueberry'])
    expect(p.isOpen()).toBe(false)
    expect(document.activeElement).toBe(p.button())
  })

  it('jumps to the option starting with a typed letter (type-ahead)', () => {
    const p = show(fruit)
    p.open()
    press('c')
    expect(p.activeRow()).toBe('Cherry')
    press('Enter')
    expect(p.changes).toEqual(['Cherry'])
  })

  it('typing on the focused closed control opens it and jumps', () => {
    const p = show(fruit)
    p.button().focus()
    press('b')
    expect(p.isOpen()).toBe(true)
    expect(p.activeRow()).toBe('Banana')
    press('l')
    expect(p.activeRow()).toBe('Blueberry')
  })

  it('Home and End jump to the ends', () => {
    const p = show(fruit)
    p.open()
    press('End')
    expect(p.activeRow()).toBe('Cherry')
    press('Home')
    expect(p.activeRow()).toBe('Apple')
  })

  it('Tab takes what the arrows moved to, and moves on', () => {
    const p = show(fruit)
    p.open()
    press('ArrowDown')
    const tab = press('Tab')
    expect(p.changes).toEqual(['Banana'])
    expect(tab.defaultPrevented).toBe(false)
    expect(p.isOpen()).toBe(false)
  })

  it('Tab takes nothing while the highlight is only the current value; Shift+Tab never takes', () => {
    const p = show(fruit)
    p.open()
    press('Tab')
    expect(p.changes).toEqual([])
    expect(p.isOpen()).toBe(false)
    p.open()
    press('ArrowDown')
    press('Tab', { shiftKey: true })
    expect(p.changes).toEqual([])
  })

  it('Escape closes only the list and returns focus to the control', () => {
    const behind = vi.fn()
    const p = show(fruit, { parent: () => behind() })
    p.open()
    behind.mockClear()
    press('Escape')
    expect(p.isOpen()).toBe(false)
    expect(document.activeElement).toBe(p.button())
    expect(behind).not.toHaveBeenCalled()
  })

  it('closes on a click outside, without taking focus back', () => {
    const p = show(fruit)
    p.open()
    click(document.body)
    expect(p.isOpen()).toBe(false)
  })

  it('a click on an option picks it', () => {
    const p = show(fruit)
    p.open()
    click(document.querySelectorAll('[role="option"]')[3])
    expect(p.changes).toEqual(['Cherry'])
  })

  it('only a real pointer move highlights a row', () => {
    const p = show(fruit)
    p.open()
    const rows = document.querySelectorAll('[role="option"]')
    moveMouse(rows[2], 10, 10)
    expect(p.activeRow()).toBe('Blueberry')
    press('ArrowUp')
    expect(p.activeRow()).toBe('Banana')
    // The same position again (the list scrolled under a still pointer): no change.
    moveMouse(rows[2], 10, 10)
    expect(p.activeRow()).toBe('Banana')
    moveMouse(rows[3], 12, 10)
    expect(p.activeRow()).toBe('Cherry')
  })
})

describe('Picker, a long list', () => {
  it('has a search field past seven options, and none at seven', () => {
    const seven = show(many.slice(0, 7))
    seven.open()
    expect(seven.input()).toBeNull()
    mounted?.unmount()
    document.body.innerHTML = ''
    const eight = show(many)
    eight.open()
    expect(eight.input()).not.toBeNull()
    expect(document.activeElement).toBe(eight.input())
    expect(eight.input()?.placeholder).toBe('Search fruit')
  })

  it('filters as you type and Enter takes the first match', () => {
    const p = show(many)
    p.open()
    typeText('char')
    expect(p.rows()).toEqual(['Charlie'])
    press('Enter')
    expect(p.changes).toEqual(['Charlie'])
  })

  it('typing on the closed control opens the list with those letters in the field', () => {
    const p = show(many)
    p.button().focus()
    press('f')
    typeText('ox')
    expect(p.input()?.value).toBe('fox')
    expect(p.rows()).toEqual(['Foxtrot'])
    press('Enter')
    expect(p.changes).toEqual(['Foxtrot'])
  })

  it('ignores case and accents and looks in the description too', () => {
    const list = [...many, opt('Zürich', { description: 'The big one' })]
    const p = show(list)
    p.open()
    typeText('ZURICH')
    expect(p.rows()).toEqual(['ZürichThe big one'])
    typeText('')
    for (let i = 0; i < 6; i++) press('Backspace')
    typeText('big')
    expect(p.rows()).toEqual(['ZürichThe big one'])
  })

  it('highlights the matching letters', () => {
    const p = show(many)
    p.open()
    typeText('arl')
    expect(document.querySelector('mark')?.textContent).toBe('arl')
  })

  it('says No match', () => {
    const p = show(many)
    p.open()
    typeText('zzz')
    expect(document.body.textContent).toContain('No match')
    expect(p.rows()).toEqual([])
  })

  it('Escape closes the list even with text in the field', () => {
    const p = show(many)
    p.open()
    typeText('al')
    press('Escape')
    expect(p.isOpen()).toBe(false)
  })

  it('Tab after typing takes the first match', () => {
    const p = show(many)
    p.open()
    typeText('gol')
    press('Tab')
    expect(p.changes).toEqual(['Golf'])
  })

  it('Home and End move the caret while there is text, and jump when there is none', () => {
    const p = show(many)
    p.open()
    press('End')
    expect(p.activeRow()).toBe('Hotel')
    typeText('a')
    const home = press('Home')
    expect(home.defaultPrevented).toBe(false)
  })
})

describe('Picker, adding a value', () => {
  const addTo = (added: string[]): PickerAdd => ({ onAdd: (t) => void added.push(t) })

  it('offers Add “…” while the text is not an exact match, and Enter adds it', async () => {
    const added: string[] = []
    const p = show(many, { add: addTo(added) })
    p.open()
    typeText('Zulu')
    expect(p.rows()).toEqual(['Add “Zulu”'])
    expect(p.activeRow()).toBe('Add “Zulu”')
    await act(async () => {
      press('Enter')
    })
    expect(added).toEqual(['Zulu'])
    expect(p.isOpen()).toBe(false)
  })

  it('offers nothing to add for an exact match, in any case', () => {
    const p = show(many, { add: addTo([]) })
    p.open()
    typeText('echo')
    expect(p.rows()).toEqual(['Echo'])
    expect(p.activeRow()).toBe('Echo')
  })

  it('always has the search field, even on a short list', () => {
    const p = show(fruit, { add: addTo([]) })
    p.open()
    expect(p.input()).not.toBeNull()
  })

  it('with several matches the Add row is the default, as the group field has always done', () => {
    const p = show(fruit, { add: addTo([]) })
    p.open()
    typeText('b')
    expect(p.rows()).toEqual(['Banana', 'Blueberry', 'Add “b”'])
    expect(p.activeRow()).toBe('Add “b”')
  })

  it('the arrows wrap at the ends, so Down from the Add row goes to the first match', () => {
    const p = show(fruit, { add: addTo([]) })
    p.open()
    typeText('b')
    press('ArrowDown')
    expect(p.activeRow()).toBe('Banana')
    press('ArrowUp')
    expect(p.activeRow()).toBe('Add “b”')
  })

  it('shows the message of an add that fails and stays open', async () => {
    const add: PickerAdd = { onAdd: () => Promise.reject(new Error('Nope')) }
    const p = show(many, { add })
    p.open()
    typeText('Zulu')
    await act(async () => {
      press('Enter')
    })
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Nope')
    expect(p.isOpen()).toBe(true)
  })

  it('canAdd hides the row for text that cannot be a value', () => {
    const p = show(many, { add: { onAdd: () => {}, canAdd: (t) => !t.includes('/') } })
    p.open()
    typeText('a/b')
    expect(p.rows()).toEqual([])
  })
})
