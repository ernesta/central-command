// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SkillChips } from './SkillChips'

let host: HTMLElement
let root: Root
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
})
const render = async (el: ReactElement<object>): Promise<void> => {
  await act(() => root.render(el))
}
const skills = ['Networking (RP)', 'Career development (RP)', 'Impact (RP)', 'Leadership (RP)']

describe('SkillChips', () => {
  it('shows every skill without a limit', async () => {
    await render(createElement(SkillChips, { skills }))
    expect(host.querySelectorAll('li')).toHaveLength(4)
  })

  it('with a limit shows that many, then a +N for the rest', async () => {
    await render(createElement(SkillChips, { skills, limit: 1 }))
    const items = [...host.querySelectorAll('li')].map((li) => li.textContent)
    expect(items).toEqual(['Career development (RP)', '+3'])
  })

  it('shows no +N when everything fits, and a dash for none', async () => {
    await render(createElement(SkillChips, { skills: ['Impact (RP)'], limit: 1 }))
    expect([...host.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Impact (RP)'])
    await render(createElement(SkillChips, { skills: [], limit: 1 }))
    expect(host.textContent).toBe('—')
  })
})
