import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { formatDate } from '@shared/time'
import { emptyYear, WORK_PLAN, type Invoice, type TrackingYear } from '@shared/tracking/types'

/** A contract of 26 weeks from Mon 28 Sep 2026, with or without a weekly aim. */
export function contract(options: { aim: boolean; invoice: Invoice }): TrackingYear {
  const year = emptyYear('2026-09-28', {
    ...WORK_PLAN,
    hoursPerWeek: options.aim ? 480 : 0,
    clients: ['Royal Holloway']
  })
  return {
    ...year,
    weeks: 26,
    name: 'Royal Holloway',
    invoice: options.invoice,
    sessions: [
      {
        id: 's1',
        date: '2026-10-05',
        start: '09:00:00',
        end: '11:00:00',
        minutes: 120,
        label: 'Reading',
        client: 'Royal Holloway'
      }
    ]
  }
}

export const NOW = { date: '2026-10-08', time: '12:00:00' }

let host: HTMLElement | null = null
let root: Root | null = null

export function mount(element: React.JSX.Element): HTMLElement {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  const mounted = root
  act(() => {
    mounted.render(createElement(MemoryRouter, null, element))
  })
  return host
}

export function unmount(): void {
  const mounted = root
  if (mounted)
    act(() => {
      mounted.unmount()
    })
  host?.remove()
  host = null
  root = null
}

/** Types into a controlled input the way a user does. */
export function type(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function headers(host: HTMLElement): string[] {
  return [...host.querySelectorAll('th[scope="col"]')].map((th) => th.textContent ?? '')
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** Picks a day in a date picker the way a user does: opens its calendar, pages to the month, clicks the day. */
export function pickDate(host: HTMLElement, label: string, date: string): void {
  const click = (button: Element | null): void => {
    act(() => {
      ;(button as HTMLElement).click()
    })
  }
  // A month as a count, so "October 2026" and "2027-03" compare.
  const shown = (): number => {
    const [name, year] = (host.querySelector('[aria-live="polite"]')?.textContent ?? '').split(' ')
    return Number(year) * 12 + MONTH_NAMES.indexOf(name ?? '')
  }
  const target = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
  if (!host.querySelector('[role="dialog"]'))
    click(host.querySelector(`button[aria-label^="${label}:"]`))
  for (let i = 0; i < 60 && shown() !== target; i++)
    click(
      host.querySelector(`button[aria-label="${shown() < target ? 'Next' : 'Previous'} month"]`)
    )
  click(host.querySelector(`button[aria-label="${formatDate(date)}"]`))
}
