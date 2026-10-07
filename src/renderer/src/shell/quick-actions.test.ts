// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { openNewTask } from '@modules/tasks/renderer/new-task-store'
import { quickActionWorkspace, runQuickAction } from './quick-actions'

vi.mock('@modules/tasks/renderer/new-task-store', () => ({ openNewTask: vi.fn() }))

describe('runQuickAction', () => {
  it('creates a note and goes to it', async () => {
    const create = vi.fn(async () => ({ ref: { id: 'Untitled' } }))
    ;(window as unknown as { api: unknown }).api = { notes: { create } }
    const navigate = vi.fn()
    await runQuickAction('new-note', navigate)
    expect(create).toHaveBeenCalledWith({ workspace: 'research' })
    expect(navigate).toHaveBeenCalledWith('/research/notes/n/Untitled', {
      state: { focus: 'body' }
    })
  })

  it('starts a note in the workspace it is given', async () => {
    const create = vi.fn(async () => ({ ref: { id: 'Untitled' } }))
    ;(window as unknown as { api: unknown }).api = { notes: { create } }
    const navigate = vi.fn()
    await runQuickAction('new-note', navigate, 'work')
    expect(create).toHaveBeenCalledWith({ workspace: 'work' })
    expect(navigate).toHaveBeenCalledWith('/work/notes/n/Untitled', { state: { focus: 'body' } })
  })

  it('starts a note in Life', async () => {
    const create = vi.fn(async () => ({ ref: { id: 'Untitled' } }))
    ;(window as unknown as { api: unknown }).api = { notes: { create } }
    await runQuickAction('new-note', vi.fn(), 'life')
    expect(create).toHaveBeenCalledWith({ workspace: 'life' })
  })

  it('starts a task in Research from Life, which has no tasks', async () => {
    await runQuickAction('new-task', vi.fn(), 'life')
    expect(openNewTask).toHaveBeenCalledWith({ workspace: 'research' })
  })

  it('starts a meeting in Work with the series Other', async () => {
    const create = vi.fn(async () => ({ ref: { id: 'm1' } }))
    ;(window as unknown as { api: unknown }).api = { meetings: { create } }
    await runQuickAction('new-meeting', vi.fn(), 'work')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ workspace: 'work', series: 'Other' })
    )
  })

  it('opens the New task dialog for the workspace it is given', async () => {
    await runQuickAction('new-task', vi.fn(), 'work')
    expect(openNewTask).toHaveBeenCalledWith({ workspace: 'work' })
  })

  it('does nothing for an id it does not know', async () => {
    const navigate = vi.fn()
    await runQuickAction('mystery' as never, navigate)
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('quickActionWorkspace', () => {
  it('follows the page, then the workspace last visited, then Research', () => {
    expect(quickActionWorkspace('/work/notes/all')).toBe('work')
    expect(quickActionWorkspace('/research/notes', 'work')).toBe('research')
    expect(quickActionWorkspace('/search', 'work')).toBe('work')
    expect(quickActionWorkspace('/settings', 'life')).toBe('life')
    expect(quickActionWorkspace('/life/notes')).toBe('life')
    expect(quickActionWorkspace('/')).toBe('research')
  })
})
