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
  it('renames the task, which the main process carries to the hours', async () => {
    await renameRow('research', 'y', 'd', { label: 'Old', task: 'cc://task/abc' }, ' New ')
    expect(update).toHaveBeenCalledWith('abc', { title: 'New' })
    expect(renameTask).not.toHaveBeenCalled()
  })

  it('changes only the label when the row has no task', async () => {
    await renameRow('research', 'y', 'd', { label: 'Old' }, 'New')
    expect(update).not.toHaveBeenCalled()
    expect(renameTask).toHaveBeenCalledWith('research', 'y', 'd', 'Old', 'New', undefined)
  })

  it('rejects when the task cannot be renamed', async () => {
    update.mockRejectedValue(new Error('no'))
    await expect(
      renameRow('research', 'y', 'd', { label: 'Old', task: 'cc://task/abc' }, 'New')
    ).rejects.toThrow('no')
  })
})
