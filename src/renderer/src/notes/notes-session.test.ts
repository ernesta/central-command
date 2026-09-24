import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteChangedEvent, NoteContent, NoteWriteResult } from '@shared/notes'
import { NotesSession, type NotesApi } from './notes-session'

const hash = (content: string): string => `h:${content}`

/** An in-memory notes file behaving like the real store: hash-checked writes, change events. */
class FakeDisk implements NotesApi {
  content = ''
  exists = false
  writes: string[] = []
  writeAttempts = 0
  failNextWrite: Error | null = null
  private listeners = new Set<(event: NoteChangedEvent) => void>()
  private gate: (() => void) | null = null
  holdWrites = false

  read = async (): Promise<NoteContent> => ({
    exists: this.exists,
    content: this.content,
    hash: hash(this.content)
  })

  write = async (_citekey: string, content: string, baseHash: string): Promise<NoteWriteResult> => {
    this.writeAttempts++
    if (this.failNextWrite) {
      const error = this.failNextWrite
      this.failNextWrite = null
      throw error
    }
    if (this.holdWrites) await new Promise<void>((resolve) => (this.gate = resolve))
    if (this.content === content) return { status: 'saved', hash: hash(content) }
    if (hash(this.content) !== baseHash) {
      return {
        status: 'conflict',
        disk: { exists: this.exists, content: this.content, hash: hash(this.content) }
      }
    }
    this.content = content
    this.exists = true
    this.writes.push(content)
    return { status: 'saved', hash: hash(content) }
  }

  onChanged = (listener: (event: NoteChangedEvent) => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  release(): void {
    this.holdWrites = false
    this.gate?.()
  }
  /** Another tool edits the file, and the watcher reports it. */
  externalEdit(content: string): void {
    this.content = content
    this.exists = true
    for (const l of this.listeners) l({ citekey: 'k', hash: hash(content) })
  }
  emit(event: NoteChangedEvent): void {
    for (const l of this.listeners) l(event)
  }
  echo(content: string): void {
    for (const l of this.listeners) l({ citekey: 'k', hash: hash(content) })
  }
  listenerCount(): number {
    return this.listeners.size
  }
}

let disk: FakeDisk
let session: NotesSession
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(async () => {
  vi.useFakeTimers()
  disk = new FakeDisk()
})
afterEach(async () => {
  await session?.dispose()
  vi.useRealTimers()
})

async function open(initial?: string): Promise<void> {
  if (initial !== undefined) {
    disk.content = initial
    disk.exists = true
  }
  session = new NotesSession('k', disk, { debounceMs: 500 })
  await session.start()
}

describe('loading', () => {
  it('starts loading, then presents the file as the editor content', async () => {
    disk.content = '# Existing'
    disk.exists = true
    session = new NotesSession('k', disk)
    expect(session.getSnapshot().status).toBe('loading')
    await session.start()
    expect(session.getSnapshot()).toMatchObject({
      status: 'ready',
      initial: '# Existing',
      save: 'clean',
      hasContent: true,
      conflict: null
    })
  })
  it('opens a missing note as empty without creating a file', async () => {
    await open()
    expect(session.getSnapshot()).toMatchObject({ initial: '', hasContent: false })
    expect(disk.exists).toBe(false)
  })
})

describe('autosave', () => {
  it('saves about 500 ms after typing stops, not on every keystroke', async () => {
    await open()
    session.edit('h')
    await vi.advanceTimersByTimeAsync(300)
    session.edit('he')
    await vi.advanceTimersByTimeAsync(300)
    session.edit('hel')
    expect(disk.writes).toEqual([])
    expect(session.getSnapshot().save).toBe('dirty')
    await vi.advanceTimersByTimeAsync(500)
    expect(disk.writes).toEqual(['hel'])
    expect(session.getSnapshot().save).toBe('clean')
  })

  it('saves immediately on flush (blur, leaving the page)', async () => {
    await open()
    session.edit('quick note')
    await session.flush()
    expect(disk.writes).toEqual(['quick note'])
  })

  it('saves pending edits when the session is disposed', async () => {
    await open()
    session.edit('unsaved at exit')
    await session.dispose()
    expect(disk.writes).toEqual(['unsaved at exit'])
    expect(disk.listenerCount()).toBe(0)
  })

  it('chains saves so each builds on the previous one', async () => {
    await open()
    session.edit('one')
    await session.flush()
    session.edit('one two')
    await session.flush()
    expect(disk.writes).toEqual(['one', 'one two'])
  })

  it('saves the latest text if typing continues while a save is in flight', async () => {
    await open()
    disk.holdWrites = true
    session.edit('first')
    const pending = session.flush()
    await settle()
    expect(session.getSnapshot().save).toBe('saving')
    session.edit('first and more')
    disk.release()
    await pending
    await vi.advanceTimersByTimeAsync(600)
    expect(disk.writes).toEqual(['first', 'first and more'])
    expect(session.getSnapshot().save).toBe('clean')
  })

  it('does not save when the text ends up equal to what is saved', async () => {
    await open('same')
    session.edit('same!')
    session.edit('same')
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.writes).toEqual([])
    expect(session.getSnapshot().save).toBe('clean')
  })

  it('never creates a file for an empty note', async () => {
    await open()
    session.edit('')
    await session.flush()
    expect(disk.exists).toBe(false)
  })

  it('reports a failed save and recovers on the next edit', async () => {
    await open()
    disk.failNextWrite = new Error('disk full')
    session.edit('text')
    await session.flush()
    expect(session.getSnapshot()).toMatchObject({ save: 'error', error: 'disk full' })
    session.edit('text again')
    await session.flush()
    expect(session.getSnapshot()).toMatchObject({ save: 'clean', error: null })
    expect(disk.writes).toEqual(['text again'])
  })

  it('tracks whether the note has content', async () => {
    await open()
    session.edit('   ')
    expect(session.getSnapshot().hasContent).toBe(false)
    session.edit('words')
    expect(session.getSnapshot().hasContent).toBe(true)
  })
})

describe('external changes', () => {
  it('loads another tool’s edit straight in when the editor is clean', async () => {
    await open('original')
    const keyBefore = session.getSnapshot().editorKey
    disk.externalEdit('edited by Claude Code')
    await settle()
    expect(session.getSnapshot()).toMatchObject({
      initial: 'edited by Claude Code',
      reloadedFromDisk: true,
      conflict: null,
      save: 'clean'
    })
    expect(session.getSnapshot().editorKey).toBe(keyBefore + 1)
  })

  it('offers a choice instead of overwriting when the editor has unsaved edits', async () => {
    await open('original')
    session.edit('original plus my typing')
    disk.externalEdit('edited elsewhere')
    await settle()
    expect(session.getSnapshot().conflict).toMatchObject({ content: 'edited elsewhere' })
    expect(session.getSnapshot().initial).toBe('original')
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.writes).toEqual([])
    expect(disk.content).toBe('edited elsewhere')
  })

  it('ignores the echo of its own save', async () => {
    await open()
    session.edit('mine')
    await session.flush()
    const before = session.getSnapshot()
    disk.echo('mine')
    await settle()
    expect(session.getSnapshot()).toBe(before)
  })

  it('does not mistake the echo of its own save for a conflict when it arrives before the save reply', async () => {
    await open()
    disk.holdWrites = true
    session.edit('mine')
    const pending = session.flush()
    await settle()
    // The file is already written (the watcher saw it), but the reply has not arrived yet.
    disk.content = 'mine'
    disk.exists = true
    disk.echo('mine')
    await settle()
    expect(session.getSnapshot().conflict).toBeNull()
    expect(session.getSnapshot().reloadedFromDisk).toBe(false)
    disk.release()
    await pending
    expect(session.getSnapshot()).toMatchObject({ save: 'clean', conflict: null })
    // A later edit still saves normally.
    session.edit('mine, continued')
    await session.flush()
    expect(disk.content).toBe('mine, continued')
  })

  it('ignores echoes of older own saves that arrive late, even while typing on', async () => {
    await open()
    session.edit('v1')
    await session.flush()
    session.edit('v2')
    await session.flush()
    session.edit('v3 typing')
    disk.echo('v1')
    disk.echo('v2')
    await settle()
    expect(session.getSnapshot().conflict).toBeNull()
    expect(session.getSnapshot().reloadedFromDisk).toBe(false)
  })

  it('ignores change events for other readings, even if this note also changed meanwhile', async () => {
    await open('mine')
    disk.content = 'changed without an event'
    disk.emit({ citekey: 'someone-else', hash: hash('x') })
    await settle()
    expect(session.getSnapshot()).toMatchObject({
      initial: 'mine',
      reloadedFromDisk: false,
      conflict: null
    })
  })

  it('treats a file deleted elsewhere as an empty note when the editor is clean', async () => {
    await open('something')
    disk.content = ''
    disk.exists = false
    disk.echo('')
    await settle()
    expect(session.getSnapshot()).toMatchObject({
      initial: '',
      hasContent: false,
      reloadedFromDisk: true
    })
  })
})

describe('conflicts found while saving', () => {
  it('pauses saving and reports the disk version when the file changed unnoticed', async () => {
    await open('base')
    disk.content = 'changed without an event'
    session.edit('base and mine')
    await session.flush()
    expect(session.getSnapshot().conflict).toMatchObject({ content: 'changed without an event' })
    expect(disk.content).toBe('changed without an event')
    // While a conflict is open, further typing does not write.
    const attempts = disk.writeAttempts
    session.edit('base and mine, more')
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.writeAttempts).toBe(attempts)
    expect(disk.content).toBe('changed without an event')
  })

  it('"Keep mine" overwrites the file with the editor content', async () => {
    await open('base')
    disk.content = 'theirs'
    session.edit('mine')
    await session.flush()
    await session.keepMine()
    expect(disk.content).toBe('mine')
    expect(session.getSnapshot()).toMatchObject({ conflict: null, save: 'clean' })
  })

  it('"Use the file’s version" replaces the editor content and discards our edits', async () => {
    await open('base')
    disk.content = 'theirs'
    session.edit('mine')
    await session.flush()
    const keyBefore = session.getSnapshot().editorKey
    await session.useDisk()
    expect(session.getSnapshot()).toMatchObject({
      initial: 'theirs',
      conflict: null,
      save: 'clean'
    })
    expect(session.getSnapshot().editorKey).toBe(keyBefore + 1)
    expect(disk.content).toBe('theirs')
    await vi.advanceTimersByTimeAsync(1000)
    await session.flush()
    expect(disk.writes).toEqual([])
    expect(disk.content).toBe('theirs')
    // Our discarded edits must not come back as a fresh conflict.
    expect(session.getSnapshot()).toMatchObject({ conflict: null, save: 'clean' })
  })

  it('resolving with no conflict open does nothing', async () => {
    await open('x')
    await session.keepMine()
    await session.useDisk()
    expect(session.getSnapshot().initial).toBe('x')
  })
})

describe('lifecycle', () => {
  it('can be started again after being disposed (StrictMode remounts)', async () => {
    await open('text')
    await session.dispose()
    expect(disk.listenerCount()).toBe(0)
    await session.start()
    expect(disk.listenerCount()).toBe(1)
    disk.externalEdit('edited after restart')
    await settle()
    expect(session.getSnapshot()).toMatchObject({
      initial: 'edited after restart',
      reloadedFromDisk: true
    })
  })

  it('survives React StrictMode: start, dispose and start again without waiting in between', async () => {
    disk.content = 'my note'
    disk.exists = true
    session = new NotesSession('k', disk)
    // StrictMode runs effect, cleanup, effect back to back; none of them is awaited.
    const first = session.start()
    const disposing = session.dispose()
    const second = session.start()
    await Promise.all([first, disposing, second])
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', initial: 'my note' })
    expect(disk.listenerCount()).toBe(1)
    disk.externalEdit('changed later')
    await settle()
    expect(session.getSnapshot()).toMatchObject({
      initial: 'changed later',
      reloadedFromDisk: true
    })
  })

  it('does nothing until started', async () => {
    session = new NotesSession('k', disk)
    expect(disk.listenerCount()).toBe(0)
    expect(session.getSnapshot().status).toBe('loading')
  })
})

describe('subscriptions', () => {
  it('notifies subscribers of changes and stops after unsubscribe', async () => {
    await open()
    const listener = vi.fn()
    const off = session.subscribe(listener)
    session.edit('a')
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    off()
    session.edit('ab')
    expect(listener).not.toHaveBeenCalled()
  })
})
