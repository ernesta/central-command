// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { decorationsOf, stateFor } from './live-test-utils'
import { openView, press, show } from './live-key-utils'

const widgets = (doc: string): { text: string; from: number }[] =>
  decorationsOf(stateFor(doc))
    .filter((seen) => seen.kind === 'widget')
    .map((seen) => ({ text: doc.slice(seen.from, seen.to), from: seen.from }))

describe('lists drawn as units', () => {
  it('draws the marker and the space after it as one unit, for every kind of item', () => {
    expect(widgets('- a\n* b\n+ c\n\n1. d\n2) e\n\n- [ ] f\n- [x] g').map((w) => w.text)).toEqual([
      '- ',
      '* ',
      '+ ',
      '1. ',
      '2) ',
      '- [ ] ',
      '- [x] '
    ])
  })

  it('includes the nesting in the unit of a nested item, and leaves out the quote markers', () => {
    const doc = '- a\n    - b\n\n> - q'
    expect(widgets(doc).map((w) => w.text)).toEqual(['- ', '    - ', '- '])
  })

  it('leaves a dash that is not yet followed by a space, a rule and a dash in the text alone', () => {
    expect(widgets('-5 degrees\n\n---\n\n-')).toEqual([])
  })

  it('does not draw a marker inside code', () => {
    expect(widgets('```\n- not a list\n```\n\n    - indented code')).toEqual([])
  })

  it('does not change the text', () => {
    const doc = '- a\n  - b\n1. c\n- [x] d'
    expect(stateFor(doc).sliceDoc()).toBe(doc)
  })

  it('marks a ticked item as done', () => {
    const kinds = decorationsOf(stateFor('- [x] finished\n- [ ] open')).filter(
      (seen) => seen.kind === 'live-done'
    )
    expect(kinds).toHaveLength(1)
  })
})

describe('in the running editor', () => {
  it('moves over a bullet in one step, both ways', () => {
    const { view } = openView('|- one\n- two')
    expect(press(view, 'ArrowRight')).toBe(true)
    expect(show(view)).toBe('- |one\n- two')
    press(view, 'ArrowLeft')
    expect(show(view)).toBe('|- one\n- two')
  })

  it('moves over a checkbox in one step', () => {
    const { view } = openView('|- [ ] task')
    press(view, 'ArrowRight')
    expect(show(view)).toBe('- [ ] |task')
  })

  it('Home goes to the start of an indented item’s text, never into the marker', () => {
    const { view } = openView('- a\n    - b|c')
    press(view, 'Home')
    expect(show(view)).toBe('- a\n    - |bc')
  })

  it('Shift-Home selects up to the start of the text, keeping the other end', () => {
    const { view } = openView('- a\n  - bc|')
    press(view, 'Shift-Home')
    expect(show(view)).toBe('- a\n  - |bc|')
  })

  it('a click on the checkbox writes [x], and another writes [ ] again', () => {
    const { view, reports } = openView('- [ ] task\n\nafter')
    const box = (): Element => view.dom.querySelector('.live-checkbox') as Element
    box().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(view.state.sliceDoc()).toBe('- [x] task\n\nafter')
    expect(reports).toEqual(['- [x] task\n\nafter'])
    expect(box().getAttribute('aria-checked')).toBe('true')
    box().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(view.state.sliceDoc()).toBe('- [ ] task\n\nafter')
  })

  it('ticks the right item, and a nested one, and only that character', () => {
    const { view } = openView('- [ ] a\n  - [ ] b\n- [ ] c')
    const boxes = view.dom.querySelectorAll('.live-checkbox')
    boxes[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(view.state.sliceDoc()).toBe('- [ ] a\n  - [x] b\n- [ ] c')
  })
})
