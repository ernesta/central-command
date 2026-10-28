import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TaskSecondLine } from './TaskSecondLine'

const today = '2026-10-05'
const render = (due: string | null, status = 'todo', noLate = false): string =>
  renderToStaticMarkup(
    createElement(TaskSecondLine, {
      parent: null,
      list: 'Impact › Data',
      task: { due, status },
      today,
      noLate
    })
  )
const text = (html: string): string => html.replace(/<[^>]*>/g, '')

describe('TaskSecondLine', () => {
  it('words the date as due today, due tomorrow, due 12 Nov, with no chip', () => {
    expect(text(render(today))).toBe('Impact › Data · due today')
    expect(text(render('2026-10-06'))).toBe('Impact › Data · due tomorrow')
    expect(text(render('2026-10-12'))).toBe('Impact › Data · due Oct 12')
    expect(render('2026-10-12')).not.toContain('late')
  })

  it('leaves the late chip out with noLate, keeping the place', () => {
    expect(text(render('2026-10-02', 'todo', true))).toBe('Impact › Data')
    expect(render('2026-10-02', 'todo', true)).not.toContain('late')
  })

  it('shows the late chip, never the past date, for an overdue task', () => {
    expect(text(render('2026-10-02'))).toBe('Impact › Data3 days late')
    expect(render('2026-10-02')).not.toContain('due')
  })

  it('shows neither for a done task or one with no date', () => {
    expect(text(render('2026-10-02', 'done'))).toBe('Impact › Data')
    expect(text(render(null))).toBe('Impact › Data')
  })
})
