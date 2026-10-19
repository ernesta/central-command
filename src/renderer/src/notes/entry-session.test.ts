import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearUndoStack, undoLast } from '@renderer/components/undo-store'
import { EntrySession, type EntryFile, type EntrySessionApi } from './entry-session'

vi.mock('@renderer/lib/ipc-error', () => ({
  ipcErrorMessage: (e: unknown) => String(e),
  friendlyFileError: (e: unknown) => String(e)
}))

interface Meta {
  mode: string | null
  date: string
}
type Ref = { id: string; workspace: string }

function session(): EntrySession<Ref, Meta> {
  const file: EntryFile<Ref, Meta> = {
    ref: { id: 'a', workspace: 'research' },
    note: { exists: true, content: '', hash: 'h' },
    meta: { mode: null, date: '2026-10-19' },
    body: '',
    problems: []
  }
  const api: EntrySessionApi<Ref, Meta> = {
    read: async () => file,
    save: async () => ({ status: 'saved', hash: 'h2' }),
    onChanged: () => () => {}
  }
  return new EntrySession(
    file.ref,
    api,
    {
      emptyMeta: { mode: null, date: '' },
      parseDisk: () => ({ meta: file.meta, body: '' }),
      missingPattern: /gone/,
      noun: 'test'
    },
    { debounceMs: 100000 }
  )
}

afterEach(() => {
  clearUndoStack()
  vi.useRealTimers()
})

describe('setMetaUndoable', () => {
  it('Cmd-Z puts the fields back, and the same field changed at once stays one step', async () => {
    vi.useFakeTimers()
    const s = session()
    await s.start()
    s.setMetaUndoable({ date: '2026-10-2' })
    s.setMetaUndoable({ date: '2026-10-20' })
    s.setMetaUndoable({ mode: 'online' })
    expect(s.getSnapshot().meta).toEqual({ mode: 'online', date: '2026-10-20' })
    await undoLast()
    expect(s.getSnapshot().meta).toEqual({ mode: null, date: '2026-10-20' })
    await undoLast()
    expect(s.getSnapshot().meta).toEqual({ mode: null, date: '2026-10-19' })
    expect(await undoLast()).toBe(false)
  })

  it('is skipped once the page is gone', async () => {
    const s = session()
    await s.start()
    s.setMetaUndoable({ mode: 'online' })
    await s.dispose()
    expect(await undoLast()).toBe(false)
  })
})
