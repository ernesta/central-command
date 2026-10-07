// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { clearPickerRequest, currentPickerRequest } from '@modules/hours/renderer/start-request'
import { searchCommands } from './commands'

describe('searchCommands', () => {
  it('finds a command by (part of) its title, folding case', async () => {
    expect((await searchCommands('new note', vi.fn())).map((h) => h.key)).toEqual(['new-note'])
    expect((await searchCommands('SETTINGS', vi.fn())).map((h) => h.key)).toEqual(['open-settings'])
  })

  it('finds nothing for a word no command has', async () => {
    expect(await searchCommands('zzzzqq', vi.fn())).toEqual([])
  })

  it('runs the command against the navigate function it is given, not one of its own', async () => {
    const navigate = vi.fn()
    const [hit] = await searchCommands('open settings', navigate)
    await hit.run?.()
    expect(navigate).toHaveBeenCalledWith('/settings')
  })

  it('shows at most the given limit', async () => {
    expect(await searchCommands('new', vi.fn(), 1)).toHaveLength(1)
  })

  describe('timer commands', () => {
    const withTimer = (running: { session: { task?: string } } | null): void => {
      ;(window as unknown as { api: unknown }).api = {
        tracking: {
          running: async () => running,
          start: vi.fn(async () => ({ ok: true, running: {} })),
          stop: vi.fn(async () => ({ ok: true, running: null }))
        }
      }
    }
    it('offers Stop timer only while a timer runs, and Start timer only while none does', async () => {
      withTimer({ session: { task: 'cc://task/a' } })
      expect((await searchCommands('timer', vi.fn())).map((h) => h.key)).toEqual(['stop-timer'])
      withTimer(null)
      expect((await searchCommands('timer', vi.fn())).map((h) => h.key)).toEqual(['start-timer'])
    })

    it('stops a timer that has a task', async () => {
      withTimer({ session: { task: 'cc://task/a' } })
      const [hit] = await searchCommands('stop timer', vi.fn())
      await hit.run?.()
      expect(window.api.tracking.stop).toHaveBeenCalled()
    })

    it('does not stop a timer with no task: it asks for one first', async () => {
      withTimer({ session: {} })
      clearPickerRequest()
      const [hit] = await searchCommands('stop timer', vi.fn())
      await hit.run?.()
      expect(window.api.tracking.stop).not.toHaveBeenCalled()
      expect(currentPickerRequest()).toMatchObject({ stopAfter: true })
    })

    it('Start timer starts at once in the current workspace and opens the picker', async () => {
      withTimer(null)
      clearPickerRequest()
      const navigate = vi.fn()
      const [hit] = await searchCommands('start timer', navigate, 6, 'work')
      await hit.run?.()
      expect(window.api.tracking.start).toHaveBeenCalledWith('work', '', undefined, undefined)
      expect(navigate).not.toHaveBeenCalled()
      expect(currentPickerRequest()).toMatchObject({ stopAfter: false })
    })

    it('Start timer in Life starts in Research', async () => {
      withTimer(null)
      const [hit] = await searchCommands('start timer', vi.fn(), 6, 'life')
      await hit.run?.()
      expect(window.api.tracking.start).toHaveBeenCalledWith('research', '', undefined, undefined)
    })
  })
})
