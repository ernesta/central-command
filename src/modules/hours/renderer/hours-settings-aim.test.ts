// @vitest-environment jsdom
import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contract, mount, type, unmount } from './hours-ui-test-utils'

const year = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('@renderer/state/use-tracking-year', () => ({
  useTrackingYear: () => ({ data: year.value })
}))
vi.mock('./ContractFields', () => ({ ContractFields: () => null }))
vi.mock('./ClientFields', () => ({ ClientFields: () => null }))
vi.mock('./ContractsTable', () => ({ ContractsTable: () => null }))
vi.mock('@renderer/shell/YearFields', () => ({ YearFields: () => null }))

import { HoursSettings } from './HoursSettings'

const setPlan = vi.fn()
beforeEach(() => {
  setPlan.mockReset()
  ;(window as unknown as { api: unknown }).api = { tracking: { setPlan } }
})
afterEach(unmount)

function field(host: HTMLElement): HTMLInputElement {
  return host.querySelector<HTMLInputElement>('#hours-work-per-week')!
}
function leave(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
}

describe('Hours per week in Settings, Work', () => {
  it('reads "none" for a contract with no aim, not 0:00', () => {
    year.value = contract({ aim: false, invoice: 'week' })
    expect(field(mount(createElement(HoursSettings))).value).toBe('none')
  })

  it('sets a contract back to none when the field is cleared or says none', () => {
    year.value = contract({ aim: true, invoice: 'month' })
    const input = field(mount(createElement(HoursSettings)))
    expect(input.value).toBe('8:00')
    type(input, '')
    leave(input)
    expect(setPlan).toHaveBeenCalledWith('work', '2026-09-28', { hoursPerWeek: 0 })
  })

  it('refuses nonsense and does not save it', () => {
    year.value = contract({ aim: true, invoice: 'month' })
    const input = field(mount(createElement(HoursSettings)))
    type(input, 'abc')
    leave(input)
    expect(setPlan).not.toHaveBeenCalled()
  })
})
