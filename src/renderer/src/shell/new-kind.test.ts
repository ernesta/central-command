// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { parseSearch } from '@shared/search-query'
import { runNewKind } from './new-kind'

describe('runNewKind', () => {
  it('starts the kind in the workspace of the page, or the one workspace: names', async () => {
    const create = vi.fn(async () => ({ ref: { id: 'm1' } }))
    ;(window as unknown as { api: unknown }).api = { meetings: { create } }
    await runNewKind(parseSearch('new:meeting'), vi.fn(), 'work')
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ workspace: 'work' }))
    await runNewKind(parseSearch('new:meeting workspace:research'), vi.fn(), 'work')
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ workspace: 'research' }))
  })

  it('does nothing without a new: word', async () => {
    const navigate = vi.fn()
    await runNewKind(parseSearch('plain words'), navigate, 'work')
    expect(navigate).not.toHaveBeenCalled()
  })
})
