import { describe, expect, it } from 'vitest'
import { tasksAllRoute } from './tasks-paths'

describe('tasksAllRoute', () => {
  it('asks for the Open view, so a remembered Done is not shown', () => {
    expect(tasksAllRoute('research', { view: 'open' })).toBe('/research/tasks/all?view=open')
  })

  it('keeps a list filter beside the view', () => {
    expect(tasksAllRoute('work', { list: 'Admin' })).toBe('/work/tasks/all?list=Admin')
  })
})
