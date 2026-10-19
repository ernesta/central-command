// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearUndoStack, undoLast } from '@renderer/components/undo-store'
import { renameRow } from './rename-row'

vi.mock('@renderer/lib/ipc-error', () => ({ ipcErrorMessage: (e: unknown) => String(e) }))

const update = vi.fn()
const renameTask = vi.fn()
const get = vi.fn()
const restoreEntries = vi.fn()

const adjust = (id: string, label: string): object => ({ id, date: 'd', label, minutes: 30 })
const yearWith = (...labels: string[]): object => ({
  sessions: [],
  adjusts: labels.map((label, i) => adjust(`id${i}`, label))
})

beforeEach(() => {
  update.mockReset()
  renameTask.mockReset()
  get.mockReset().mockResolvedValue(yearWith('Old'))
  restoreEntries.mockReset().mockResolvedValue({ ok: true })
  clearUndoStack()
  ;(window as unknown as { api: unknown }).api = {
    tasks: { update },
    tracking: { renameTask, get, restoreEntries }
  }
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

  it('Cmd-Z hands back exactly the entries the rename changed', async () => {
    get.mockResolvedValueOnce(yearWith('Old', 'New')).mockResolvedValueOnce(yearWith('New', 'New'))
    await renameRow('research', 'y', 'd', { label: 'Old' }, 'New')
    await undoLast()
    expect(restoreEntries).toHaveBeenCalledWith(
      'research',
      'y',
      { sessions: [], adjusts: [adjust('id0', 'Old')] },
      { sessions: [], adjusts: [adjust('id0', 'New')] }
    )
  })

  it('Cmd-Z on a renamed task gives the task its old title back', async () => {
    await renameRow('research', 'y', 'd', { label: 'Old', task: 'cc://task/abc' }, 'New')
    await undoLast()
    expect(update).toHaveBeenLastCalledWith('abc', { title: 'Old' })
  })

  it('rejects when the task cannot be renamed', async () => {
    update.mockRejectedValue(new Error('no'))
    await expect(
      renameRow('research', 'y', 'd', { label: 'Old', task: 'cc://task/abc' }, 'New')
    ).rejects.toThrow('no')
  })
})
