// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { quickActionWorkspace, runQuickAction } from './quick-actions'

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

  it('starts a meeting in Work with the series Other', async () => {
    const create = vi.fn(async () => ({ ref: { id: 'm1' } }))
    ;(window as unknown as { api: unknown }).api = { meetings: { create } }
    await runQuickAction('new-meeting', vi.fn(), 'work')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ workspace: 'work', series: 'Other' })
    )
  })

  it('starts a training entry in Life with no lecture task, and in Research with one', async () => {
    const create = vi.fn(async (...input: unknown[]) => ({ input, ref: { id: 'e1' } }))
    ;(window as unknown as { api: unknown }).api = { training: { create } }
    const navigate = vi.fn()
    await runQuickAction('new-training', navigate, 'life')
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ workspace: 'life' }))
    expect(create.mock.lastCall?.[0]).not.toHaveProperty('task')
    expect(navigate).toHaveBeenLastCalledWith('/life/training/t/e1', { state: { isNew: true } })
    await runQuickAction('new-training', navigate, 'work')
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspace: 'research', task: 'auto' })
    )
    expect(navigate).toHaveBeenLastCalledWith('/research/training/t/e1', {
      state: { isNew: true }
    })
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
