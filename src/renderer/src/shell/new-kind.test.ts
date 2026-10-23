// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { parseSearch } from '@shared/search-query'
import { currentToast } from '@renderer/components/toast-store'
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

  it('makes a task with the title, list, due date, priority and tags the query names', async () => {
    const create = vi.fn(async () => ({ uid: 't1' }))
    const navigate = vi.fn()
    ;(window as unknown as { api: unknown }).api = {
      tasks: { create, list: async () => [], clients: async () => ['Luminos'] },
      settings: { get: async () => ({ ui: { moduleState: {} } }) }
    }
    await runNewKind(
      parseSearch(
        'new:task Write intro list:Luminos/Study-1 due:tomorrow priority:p1 tag:draft',
        '2026-10-19'
      ),
      navigate,
      'work'
    )
    expect(create).toHaveBeenCalledWith({
      workspace: 'work',
      title: 'Write intro',
      list: 'Luminos',
      sublist: 'Study-1',
      due: '2026-10-20',
      priority: 'high',
      tags: ['draft']
    })
    expect(navigate).toHaveBeenCalled()
  })

  it('says why when Work refuses a list that is no client', async () => {
    const create = vi.fn(async () => {
      throw new Error('"Inbox" is not a client')
    })
    ;(window as unknown as { api: unknown }).api = {
      tasks: { create, list: async () => [], clients: async () => ['Luminos'] },
      settings: { get: async () => ({ ui: { moduleState: {} } }) }
    }
    const navigate = vi.fn()
    await runNewKind(parseSearch('new:task list:Inbox'), navigate, 'work')
    expect(navigate).not.toHaveBeenCalled()
    expect(currentToast()?.text).toContain('is not a client')
  })

  it('uses the words as the title of a note, a reading list and a training', async () => {
    const note = vi.fn(async () => ({ ref: { id: 'n' } }))
    const list = vi.fn(async () => ({ ref: { id: 'l' } }))
    const training = vi.fn(async () => ({ ref: { id: 'tr' } }))
    ;(window as unknown as { api: unknown }).api = {
      notes: { create: note },
      readingLists: { create: list },
      training: { create: training }
    }
    await runNewKind(parseSearch('new:note My idea'), vi.fn(), 'life')
    expect(note).toHaveBeenCalledWith({ workspace: 'life', title: 'My idea' })
    await runNewKind(parseSearch('new:reading-list Methods'), vi.fn(), 'research')
    expect(list).toHaveBeenCalledWith({ workspace: 'research', title: 'Methods' })
    await runNewKind(parseSearch('new:training R basics'), vi.fn(), 'research')
    expect(training).toHaveBeenCalledWith(expect.objectContaining({ title: 'R basics' }))
  })

  it('does nothing without a new: word', async () => {
    const navigate = vi.fn()
    await runNewKind(parseSearch('plain words'), navigate, 'work')
    expect(navigate).not.toHaveBeenCalled()
  })
})
