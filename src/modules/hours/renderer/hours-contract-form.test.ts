// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contract, mount, pickDate, type, unmount } from './hours-ui-test-utils'

const files = vi.hoisted(() => ({ value: [] as unknown[] }))
const year = vi.hoisted(() => ({ value: null as unknown }))

vi.mock('@renderer/state/use-year-files', () => ({ useYearFiles: () => files.value }))
vi.mock('./useMeetingHours', () => ({ useShownYears: (_w: string, f: unknown) => f }))
vi.mock('@renderer/state/use-tracking-year', () => ({
  useTrackingYear: () => ({ data: year.value })
}))

import { ContractFields } from './ContractFields'

const createContract = vi.fn()
beforeEach(() => {
  createContract.mockReset()
  ;(window as unknown as { api: unknown }).api = {
    tracking: { createContract, setContractEnd: vi.fn() }
  }
  year.value = contract({ aim: true, invoice: 'month' })
})
afterEach(unmount)

describe('the new-contract form', () => {
  const add = (host: HTMLElement): HTMLButtonElement =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Add') as HTMLButtonElement
  const field = (host: HTMLElement, label: string): HTMLInputElement =>
    host.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement
  const fill = (host: HTMLElement): void => {
    type(field(host, 'Name'), 'Luminos')
    type(field(host, 'Clients'), 'Impact, Teaching & Learning')
  }

  it('starts disabled, and the first day is suggested from the contract before', () => {
    const host = mount(createElement(ContractFields, { workspace: 'work' }))
    expect(add(host).disabled).toBe(true)
    // 26 weeks from 28 Sep 2026 end on 28 Mar 2027, so the next begins the day after.
    expect(host.querySelector('button[aria-label="First day: Mar 29, 2027"]')).not.toBeNull()
  })

  it('stays disabled until the name, the last day and the clients are given', () => {
    const host = mount(createElement(ContractFields, { workspace: 'work' }))
    type(field(host, 'Name'), 'Luminos')
    expect(add(host).disabled).toBe(true)
    pickDate(host, 'Last day', '2027-09-26')
    expect(add(host).disabled).toBe(true)
    type(field(host, 'Clients'), 'Impact')
    expect(add(host).disabled).toBe(false)
  })

  it('stays disabled for a last day that makes no whole weeks, unreadable hours or a blank name', () => {
    const host = mount(createElement(ContractFields, { workspace: 'work' }))
    fill(host)
    // A day that makes no whole weeks is dimmed and cannot be picked.
    pickDate(host, 'Last day', '2027-04-02')
    expect(add(host).disabled).toBe(true)
    expect(
      (host.querySelector('button[aria-label="Apr 2, 2027"]') as HTMLButtonElement).disabled
    ).toBe(true)
    pickDate(host, 'Last day', '2027-09-26')
    expect(add(host).disabled).toBe(false)
    type(field(host, 'Weekly hours'), 'lots')
    expect(add(host).disabled).toBe(true)
    type(field(host, 'Weekly hours'), '')
    expect(add(host).disabled).toBe(false)
    type(field(host, 'Name'), '   ')
    expect(add(host).disabled).toBe(true)
  })

  it('sends the terms, a blank weekly hours as no fixed hours, and clears the form when it is added', async () => {
    createContract.mockResolvedValue({ ok: true })
    const host = mount(createElement(ContractFields, { workspace: 'work' }))
    fill(host)
    pickDate(host, 'Last day', '2027-09-26')
    add(host).click()
    expect(createContract).toHaveBeenCalledWith('work', '2027-03-29', '2027-09-26', {
      name: 'Luminos',
      clients: ['Impact', 'Teaching & Learning'],
      weeklyMinutes: 0,
      invoice: 'month'
    })
    await vi.waitFor(() => expect(field(host, 'Name').value).toBe(''))
  })

  it.each([
    ['same-start', 'Another contract starts that day.'],
    ['client-overlap', 'A client is in another contract on those days.'],
    ['bad-name', 'Give the contract a name.'],
    ['bad-plan', 'Check the clients and weekly hours.'],
    ['bad-end', 'Check the dates.']
  ])('shows why the store refused (%s) and keeps what was typed', async (reason, message) => {
    createContract.mockResolvedValue({ ok: false, reason })
    const host = mount(createElement(ContractFields, { workspace: 'work' }))
    fill(host)
    pickDate(host, 'Last day', '2027-09-26')
    add(host).click()
    await vi.waitFor(() => expect(host.textContent).toContain(message))
    expect(field(host, 'Name').value).toBe('Luminos')
  })

  it('takes the message away when the form is edited again', async () => {
    createContract.mockResolvedValue({ ok: false, reason: 'same-start' })
    const host = mount(createElement(ContractFields, { workspace: 'work' }))
    fill(host)
    pickDate(host, 'Last day', '2027-09-26')
    add(host).click()
    await vi.waitFor(() => expect(host.textContent).toContain('Another contract starts'))
    type(field(host, 'Name'), 'Luminos 2')
    expect(host.textContent).not.toContain('Another contract starts')
  })
})
