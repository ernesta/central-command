import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  MeetingChangedEvent,
  MeetingFile,
  MeetingSaveResult,
  SyncPreviousResult
} from '../shared/api'
import { applyChanges, parseMeta, splitNote, type MeetingChanges } from '../shared/front-matter'
import type { MeetingRef } from '../shared/types'
import { MeetingSession, type MeetingSessionApi } from './meeting-session'

const REF: MeetingRef = { workspace: 'research', id: '2026-09-24 Supervision' }
const hash = (text: string): string => {
  let h = 5381
  for (const c of text) h = (h * 33 + c.charCodeAt(0)) | 0
  return `h${h}`
}
const FILE =
  '---\nseries: Supervision\ncolour: blue\ndate: 2026-09-24\nattendees: [Kathy Rastle]\n---\n\n## Summary\n\nHi\n\n## Notes\n\n### A\n'

/** A fake disk behind the API, so the session's saves, conflicts and events can be exercised. */
class FakeDisk implements MeetingSessionApi {
  text: string | null = FILE
  listeners = new Set<(e: MeetingChangedEvent) => void>()
  saves: { changes: MeetingChanges; baseHash: string }[] = []
  reads = 0
  syncs: string[] = []
  syncResult: (disk: FakeDisk) => SyncPreviousResult | Promise<SyncPreviousResult> = () => ({
    status: 'saved',
    hash: '',
    added: 0
  })
  failSave: Error | null = null
  gate: Promise<void> | null = null

  file(): MeetingFile {
    if (this.text === null) throw new Error('Meeting not found')
    const { head, body } = splitNote(this.text)
    const { meta, problems } = parseMeta(head)
    return {
      ref: REF,
      note: { exists: true, content: this.text, hash: hash(this.text) },
      meta,
      body,
      problems
    }
  }
  read = async (): Promise<MeetingFile> => {
    this.reads++
    return this.file()
  }
  renameTo: string | null = null
  saveRefs: string[] = []
  save = async (
    ref: MeetingRef,
    changes: MeetingChanges,
    baseHash: string
  ): Promise<MeetingSaveResult> => {
    this.saveRefs.push(ref.id)
    this.saves.push({ changes, baseHash })
    if (this.gate) await this.gate
    if (this.failSave) throw this.failSave
    const disk = this.file().note
    if (disk.hash !== baseHash) return { status: 'conflict', disk }
    this.text = applyChanges(this.text as string, changes)
    setTimeout(() => this.emit(), 0) // the watcher reports our own save a moment later
    const renamedTo = this.renameTo ?? undefined
    this.renameTo = null
    return { status: 'saved', hash: hash(this.text), renamedTo }
  }
  syncPreviousTodos = async (_ref: MeetingRef, baseHash: string): Promise<SyncPreviousResult> => {
    this.syncs.push(baseHash)
    return this.syncResult(this)
  }
  onChanged = (listener: (e: MeetingChangedEvent) => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  emit(): void {
    const event = { ref: REF, hash: this.text === null ? null : hash(this.text) }
    for (const l of this.listeners) l(event)
  }
  /** Someone else (Claude Code, Obsidian) rewrites the file. */
  external(text: string): void {
    this.text = text
    this.emit()
  }
}

let disk: FakeDisk
let session: MeetingSession
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  disk = new FakeDisk()
  session = new MeetingSession(REF, disk, { debounceMs: 500 })
})
afterEach(() => vi.useRealTimers())

describe('start', () => {
  it('loads the meeting and its note', async () => {
    await session.start()
    const s = session.getSnapshot()
    expect(s.status).toBe('ready')
    expect(s.meta).toMatchObject({
      series: 'Supervision',
      date: '2026-09-24',
      attendees: ['Kathy Rastle']
    })
    expect(s.initialBody).toBe(splitNote(FILE).body)
    expect(s.editorKey).toBe(1)
    expect(s.save).toBe('clean')
  })

  it('reports a meeting that does not exist', async () => {
    disk.text = null
    await session.start()
    expect(session.getSnapshot().status).toBe('missing')
  })

  it('fills the previous TODOs before showing the note, using the hash it just read', async () => {
    const carried = FILE.replace('### A\n', '### A\n- [ ] carried\n')
    disk.syncResult = (d) => {
      d.text = carried
      return { status: 'saved', hash: hash(carried), added: 1 }
    }
    await session.start()
    expect(disk.syncs).toEqual([hash(FILE)])
    expect(session.getSnapshot().initialBody).toContain('- [ ] carried')
    expect(session.getSnapshot().save).toBe('clean')
  })

  it('opens the meeting even when the carry-over fails or conflicts', async () => {
    disk.syncResult = () => {
      throw new Error('boom')
    }
    await session.start()
    expect(session.getSnapshot().status).toBe('ready')
    const other = new MeetingSession(REF, disk)
    disk.syncResult = () => ({ status: 'conflict', disk: disk.file().note })
    await other.start()
    expect(other.getSnapshot().status).toBe('ready')
  })

  it('survives React StrictMode: start, dispose and start again without awaiting', async () => {
    const first = session.start()
    void session.dispose()
    const second = session.start()
    await Promise.all([first, second])
    expect(session.getSnapshot().status).toBe('ready')
    expect(disk.listeners.size).toBe(1)
  })
})

describe('saving', () => {
  beforeEach(async () => {
    await session.start()
  })

  it('a body edit is saved after the debounce and leaves the front matter alone', async () => {
    session.editBody('## Summary\n\nNew\n')
    expect(session.getSnapshot().save).toBe('dirty')
    expect(disk.saves).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(disk.saves).toHaveLength(1)
    expect(disk.saves[0].changes).toEqual({ body: '## Summary\n\nNew\n' })
    expect(disk.text).toBe(splitNote(FILE).head + '## Summary\n\nNew\n')
    expect(session.getSnapshot().save).toBe('clean')
  })

  it('a field edit sends only that field and leaves the body and other keys alone', async () => {
    session.setMeta({ start: '14:00' })
    expect(session.getSnapshot().meta.start).toBe('14:00')
    await vi.advanceTimersByTimeAsync(500)
    expect(disk.saves[0].changes).toEqual({ meta: { start: '14:00' } })
    expect(disk.text).toContain("start: '14:00'")
    expect(disk.text).toContain('colour: blue')
    expect(splitNote(disk.text as string).body).toBe(splitNote(FILE).body)
  })

  it('edits to the fields and the note together go out as one save', async () => {
    session.setMeta({ mode: 'online' })
    session.editBody('changed\n')
    await vi.advanceTimersByTimeAsync(500)
    expect(disk.saves).toHaveLength(1)
    expect(disk.saves[0].changes).toEqual({ meta: { mode: 'online' }, body: 'changed\n' })
  })

  it('later saves build on the hash returned by the earlier one', async () => {
    session.setMeta({ start: '14:00' })
    await vi.advanceTimersByTimeAsync(500)
    session.editBody('two\n')
    await vi.advanceTimersByTimeAsync(500)
    expect(disk.saves).toHaveLength(2)
    expect(disk.saves[1].baseHash).toBe(hash(applyChanges(FILE, disk.saves[0].changes)))
    expect(session.getSnapshot().conflict).toBeNull()
  })

  it('flush saves immediately, and dispose saves what is pending', async () => {
    session.editBody('x\n')
    await session.flush()
    expect(disk.saves).toHaveLength(1)
    session.setMeta({ end: '15:00' })
    await session.dispose()
    expect(disk.saves).toHaveLength(2)
  })

  it('an edit made while a save is running is saved next, not lost', async () => {
    let release = (): void => undefined
    disk.gate = new Promise<void>((r) => (release = r))
    session.editBody('one\n')
    const first = session.flush()
    await settle()
    session.editBody('one two\n')
    disk.gate = null
    release()
    await first
    await vi.advanceTimersByTimeAsync(600)
    expect(splitNote(disk.text as string).body).toBe('one two\n')
    expect(session.getSnapshot().save).toBe('clean')
  })

  it('a field edited again during a save keeps its newest value', async () => {
    let release = (): void => undefined
    disk.gate = new Promise<void>((r) => (release = r))
    session.setMeta({ start: '10:00' })
    const first = session.flush()
    await settle()
    session.setMeta({ start: '11:00' })
    disk.gate = null
    release()
    await first
    await vi.advanceTimersByTimeAsync(600)
    expect(parseMeta(splitNote(disk.text as string).head).meta.start).toBe('11:00')
  })

  it('when saving renames the file, later saves and events use the new id and the page is told', async () => {
    const renamed: string[] = []
    session = new MeetingSession(REF, disk, {
      debounceMs: 500,
      onRenamed: (id) => renamed.push(id)
    })
    await session.start()
    disk.renameTo = '2026-10-01 Supervision'
    session.setMeta({ date: '2026-10-01' })
    await session.flush()
    expect(renamed).toEqual(['2026-10-01 Supervision'])
    session.editBody('more\n')
    await session.flush()
    expect(disk.saveRefs).toEqual([REF.id, '2026-10-01 Supervision'])
    expect(session.getSnapshot().conflict).toBeNull()
  })

  it('shows a save error and can try again', async () => {
    disk.failSave = new Error('Invalid date: soon')
    session.setMeta({ date: 'soon' })
    await session.flush()
    expect(session.getSnapshot()).toMatchObject({ save: 'error', error: 'Invalid date: soon' })
    disk.failSave = null
    await session.flush()
    expect(session.getSnapshot()).toMatchObject({ save: 'clean', error: null })
    expect(parseMeta(splitNote(disk.text as string).head).meta.date).toBe('')
  })

  it('replaceBody recreates the editor and saves the new text straight away', async () => {
    const key = session.getSnapshot().editorKey
    session.replaceBody('## Notes\n\n### New\n')
    await settle()
    expect(session.getSnapshot().editorKey).toBe(key + 1)
    expect(session.getSnapshot().initialBody).toBe('## Notes\n\n### New\n')
    expect(splitNote(disk.text as string).body).toBe('## Notes\n\n### New\n')
  })
})

describe('the file changing underneath', () => {
  beforeEach(async () => {
    await session.start()
  })

  it('our own saves echoing back cause nothing', async () => {
    session.editBody('mine\n')
    await session.flush()
    await settle()
    expect(session.getSnapshot()).toMatchObject({
      conflict: null,
      reloadedFromDisk: false,
      save: 'clean'
    })
    expect(disk.reads).toBe(1)
  })

  it('a change while nothing is unsaved is loaded in, and recreates the editor when the note changed', async () => {
    const key = session.getSnapshot().editorKey
    disk.external(FILE + 'added by Claude Code\n')
    await settle()
    const s = session.getSnapshot()
    expect(s.reloadedFromDisk).toBe(true)
    expect(s.initialBody).toContain('added by Claude Code')
    expect(s.editorKey).toBe(key + 1)
  })

  it('a change to a field only leaves the editor (and the cursor in it) alone', async () => {
    const key = session.getSnapshot().editorKey
    disk.external(FILE.replace('date: 2026-09-24', 'date: 2026-09-25'))
    await settle()
    const s = session.getSnapshot()
    expect(s.meta.date).toBe('2026-09-25')
    expect(s.editorKey).toBe(key)
  })

  it('with unsaved edits, a change on disk pauses saving and asks; nothing is overwritten', async () => {
    session.editBody('mine\n')
    const theirs = FILE + 'theirs\n'
    disk.external(theirs)
    await settle()
    expect(session.getSnapshot().conflict?.body).toContain('theirs')
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.saves).toHaveLength(0)
    expect(disk.text).toBe(theirs)
  })

  it('keep mine saves our version over the file, on top of the hash it read', async () => {
    session.editBody('mine\n')
    disk.external(FILE + 'theirs\n')
    await settle()
    await session.keepMine()
    expect(splitNote(disk.text as string).body).toBe('mine\n')
    expect(splitNote(disk.text as string).head).toBe(splitNote(FILE).head)
    expect(session.getSnapshot()).toMatchObject({ conflict: null, save: 'clean' })
  })

  it('keeping mine after only fields were edited leaves the note as the other tool wrote it', async () => {
    session.setMeta({ mode: 'online' })
    disk.external(FILE + 'theirs\n')
    await settle()
    await session.keepMine()
    expect(disk.text).toContain('theirs')
    expect(disk.text).toContain('mode: online')
  })

  it('use the file’s version drops our edits and reloads', async () => {
    session.editBody('mine\n')
    disk.external(FILE + 'theirs\n')
    await settle()
    await session.useDisk()
    const s = session.getSnapshot()
    expect(s.conflict).toBeNull()
    expect(s.initialBody).toContain('theirs')
    expect(s.save).toBe('clean')
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.saves).toHaveLength(0)
  })

  it('a conflict reported by the save itself is shown, not swallowed', async () => {
    session.editBody('mine\n')
    disk.text = FILE + 'theirs\n' // changed without an event, so only the save notices
    await session.flush()
    expect(session.getSnapshot().conflict?.body).toContain('theirs')
    expect(disk.text).toBe(FILE + 'theirs\n')
  })

  it('ignores events for other meetings and a deletion event', async () => {
    for (const l of disk.listeners) l({ ref: { ...REF, id: 'other' }, hash: 'x' })
    for (const l of disk.listeners) l({ ref: REF, hash: null })
    await settle()
    expect(session.getSnapshot().reloadedFromDisk).toBe(false)
  })

  it('stops listening after dispose', async () => {
    await session.dispose()
    expect(disk.listeners.size).toBe(0)
  })
})
