import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { lineDue } from '../shared/query'
import { SubtaskLine } from './SubtaskLine'

const render = (props: Parameters<typeof SubtaskLine>[0]): string =>
  renderToStaticMarkup(createElement(SubtaskLine, props))
const text = (html: string): string => html.replace(/<[^>]*>/g, '')

describe('SubtaskLine', () => {
  it('reads `list · due` for a plain task and `↳ parent · list · due` for a subtask', () => {
    expect(text(render({ parent: null, list: 'Thesis', due: 'due tomorrow' }))).toBe(
      'Thesis · due tomorrow'
    )
    expect(text(render({ parent: 'Write', list: 'Thesis › Methods', due: 'due today' }))).toBe(
      'Write · Thesis › Methods · due today'
    )
    expect(render({ parent: 'Write', list: 'Thesis' })).toContain('<svg')
  })

  it('leaves out the date when the place gives none, and a stray dot with it', () => {
    expect(text(render({ parent: null, list: 'Thesis' }))).toBe('Thesis')
    expect(text(render({ parent: null, list: 'Thesis', due: '' }))).toBe('Thesis')
    expect(text(render({ parent: 'Write', list: '', due: 'due today' }))).toBe('Write · due today')
  })

  it('shows a self-study line with its date, and none for a done or overdue task (lineDue)', () => {
    const today = '2026-10-05'
    const line = (task: { due: string | null; status: string }): string =>
      text(render({ parent: null, list: 'Training · self-study', due: lineDue(task, today) }))
    expect(line({ due: '2026-10-12', status: 'todo' })).toBe('Training · self-study · due Oct 12')
    expect(line({ due: '2026-10-12', status: 'done' })).toBe('Training · self-study')
    expect(line({ due: '2026-10-01', status: 'todo' })).toBe('Training · self-study')
  })
})
