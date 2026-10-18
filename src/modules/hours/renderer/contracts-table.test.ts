// @vitest-environment jsdom
import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyYear, WORK_PLAN } from '@shared/tracking/types'
import { contract, mount, type, unmount } from './hours-ui-test-utils'

vi.mock('@renderer/state/use-tracking-year', () => ({
  useTrackingYear: () => ({ years: ['2026-09-28'], year: '2026-09-28' })
}))

import { ContractsTable } from './ContractsTable'

const ok = { ok: true }
const api = {
  get: vi.fn(),
  onChanged: vi.fn(() => () => {}),
  setPlan: vi.fn(),
  setContractTerms: vi.fn(),
  setContractEnd: vi.fn(),
  removeContract: vi.fn()
}

async function show(year: ReturnType<typeof contract>): Promise<HTMLElement> {
  api.get.mockResolvedValue(year)
  const host = mount(createElement(ContractsTable, { workspace: 'work' }))
  await act(async () => {})
  return host
}
function press(host: HTMLElement, name: string): void {
  const button = [...host.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === name || b.textContent === name
  )
  act(() => button!.click())
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset?.())
  api.onChanged.mockImplementation(() => () => {})
  api.setPlan.mockResolvedValue(ok)
  api.setContractTerms.mockResolvedValue(ok)
  api.setContractEnd.mockResolvedValue(ok)
  ;(window as unknown as { api: unknown }).api = { tracking: api }
})
afterEach(unmount)

describe('Contracts table in Settings, Work', () => {
  it('reads "none" for a contract with no aim, not 0:00', async () => {
    const host = await show(contract({ aim: false, invoice: 'week' }))
    expect(host.querySelector('tbody')!.textContent).toContain('none')
    expect(host.querySelector('tbody')!.textContent).not.toContain('0:00')
  })

  it('sets a contract back to none when its hours are cleared', async () => {
    const host = await show(contract({ aim: true, invoice: 'month' }))
    press(host, 'Edit Royal Holloway')
    const input = host.querySelector<HTMLInputElement>('input[aria-label^="Hours a week"]')!
    expect(input.value).toBe('8:00')
    type(input, '')
    press(host, 'Save')
    await act(async () => {})
    expect(api.setPlan).toHaveBeenCalledWith('work', '2026-09-28', { hoursPerWeek: 0 })
  })

  it('refuses nonsense and does not save it', async () => {
    const host = await show(contract({ aim: true, invoice: 'month' }))
    press(host, 'Edit Royal Holloway')
    type(host.querySelector<HTMLInputElement>('input[aria-label^="Hours a week"]')!, 'abc')
    press(host, 'Save')
    await act(async () => {})
    expect(api.setPlan).not.toHaveBeenCalled()
  })

  it('offers Delete only for a contract that holds no time', async () => {
    const used = await show(contract({ aim: true, invoice: 'month' }))
    expect(used.querySelector('button[aria-label^="Delete"]')).toBeNull()
    unmount()
    const empty = await show({
      ...emptyYear('2026-09-28', { ...WORK_PLAN, clients: ['Royal Holloway'] }),
      weeks: 26,
      name: 'Royal Holloway'
    })
    expect(empty.querySelector('button[aria-label^="Delete"]')).not.toBeNull()
  })
})
