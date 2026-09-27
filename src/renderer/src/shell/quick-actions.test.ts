// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { runQuickAction } from './quick-actions'

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

  it('does nothing for an id it does not know', async () => {
    const navigate = vi.fn()
    await runQuickAction('mystery' as never, navigate)
    expect(navigate).not.toHaveBeenCalled()
  })
})
