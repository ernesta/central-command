// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renameRow } from './rename-row'

const update = vi.fn()
const renameTask = vi.fn()

beforeEach(() => {
  update.mockReset()
  renameTask.mockReset()
  ;(window as unknown as { api: unknown }).api = { tasks: { update }, tracking: { renameTask } }
})

describe('renameRow', () => {
  it('renames the task, then the labels', async () => {
    await renameRow(
      'research',
      '2026-09-21',
      '2026-10-09',
      { label: 'Old', task: 'cc://task/abc' },
      ' New '
    )
    expect(update).toHaveBeenCalledWith('abc', { title: 'New' })
    expect(renameTask).toHaveBeenCalledWith(
      'research',
      '2026-09-21',
      '2026-10-09',
      'Old',
      'New',
      undefined
    )
  })

  it('changes only the label when the row has no task', async () => {
    await renameRow('research', '2026-09-21', '2026-10-09', { label: 'Old' }, 'New')
    expect(update).not.toHaveBeenCalled()
    expect(renameTask).toHaveBeenCalled()
  })

  it('leaves the labels alone when the task cannot be renamed', async () => {
    update.mockRejectedValue(new Error('no'))
    await expect(
      renameRow('research', 'y', 'd', { label: 'Old', task: 'cc://task/abc' }, 'New')
    ).rejects.toThrow('no')
    expect(renameTask).not.toHaveBeenCalled()
  })
})
