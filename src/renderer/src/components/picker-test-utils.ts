import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/** Helpers for component tests of pickers: real key events on the focused element, and text typed into inputs. */
export interface Mounted {
  host: HTMLElement
  root: Root
  unmount: () => void
}

export function mount(element: React.JSX.Element): Mounted {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Element.prototype.scrollIntoView = () => {}
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return {
    host,
    root,
    unmount: () => {
      act(() => root.unmount())
      host.remove()
    }
  }
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** One key press on whatever has focus; a printable key the page leaves alone goes into a focused text field. */
export function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const target = (document.activeElement ?? document.body) as HTMLElement
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  if (!event.defaultPrevented && target instanceof HTMLInputElement) {
    if (key.length === 1) act(() => setInputValue(target, target.value + key))
    else if (key === 'Backspace') act(() => setInputValue(target, target.value.slice(0, -1)))
  }
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
  })
  return event
}

export function typeText(text: string): void {
  for (const char of text) press(char)
}

export function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

export function moveMouse(element: Element, x: number, y: number): void {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y })
    )
  })
}

/** A picker (or anything taking a value and onChange) with its value kept, so a test sees what a user would. */
export function Held<T>({
  initial,
  render
}: {
  initial: T
  render: (value: T, set: (value: T) => void) => React.JSX.Element
}): React.JSX.Element {
  const [value, set] = useState<T>(initial)
  return createElement('div', null, render(value, set))
}
