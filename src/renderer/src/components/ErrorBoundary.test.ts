// @vitest-environment jsdom
import { createElement, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let host: HTMLElement
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => host.remove())

function Boom(): never {
  throw new Error('boom')
}
const Fine = (): React.JSX.Element => createElement('p', null, 'all fine')

function show(root: Root, child: React.JSX.Element, resetKey = 'a'): void {
  flushSync(() => root.render(createElement(ErrorBoundary, { resetKey }, child)))
}
function render(child: React.JSX.Element): void {
  show(createRoot(host), child)
}

describe('ErrorBoundary', () => {
  it('shows the page when nothing goes wrong', () => {
    render(createElement(Fine))
    expect(host.textContent).toBe('all fine')
  })

  it('shows a short message instead of a blank window when a page fails, and says the notes are safe', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(createElement(Boom))
    expect(host.textContent).toContain('Something went wrong')
    expect(host.textContent).toContain('Your notes are safe.')
    expect(host.querySelector('button')?.textContent).toBe('Try again')
    error.mockRestore()
  })

  it('clears the failure when the page moves on, but never remounts a working page', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = createRoot(host)
    show(root, createElement(Boom), 'a')
    expect(host.textContent).toContain('Something went wrong')
    show(root, createElement(Fine), 'b')
    expect(host.textContent).toBe('all fine')
    let mounts = 0
    const Counted = (): React.JSX.Element => {
      useEffect(() => {
        mounts += 1
      }, [])
      return createElement('p', null, 'page')
    }
    show(root, createElement(Counted), 'c')
    show(root, createElement(Counted), 'd')
    expect(mounts).toBe(1)
    error.mockRestore()
  })
})
