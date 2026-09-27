import { describe, expect, it, vi } from 'vitest'
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
})
