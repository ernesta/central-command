import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteChangedEvent, NoteFile, NoteSaveResult } from '../shared/api'
import { applyChanges, parseMeta, splitNote, type NoteChanges } from '../shared/front-matter'
import type { NoteRef } from '../shared/types'
import { NoteSession, type NoteSessionApi } from './note-session'

const REF: NoteRef = { workspace: 'research', id: 'Methods' }
const hash = (text: string): string => {
  let h = 5381
  for (const c of text) h = (h * 33 + c.charCodeAt(0)) | 0
  return `h${h}`
}
const FILE =
  '---\ntitle: Methods\ngroup: Thesis\ncreated: 2026-09-03\n---\n\nSchools were recruited\n'

/** A fake disk behind the API, so the session's saves and events can be exercised. */
class FakeDisk implements NoteSessionApi {
  text = FILE
  edited = 1_700_000_000_000
  listeners = new Set<(e: NoteChangedEvent) => void>()
  saves: { changes: NoteChanges; baseHash: string }[] = []

  read = async (): Promise<NoteFile> => {
    const { head, body } = splitNote(this.text)
    const { meta, problems } = parseMeta(head)
    return {
      ref: REF,
      note: { exists: true, content: this.text, hash: hash(this.text) },
      meta,
      body,
      edited: this.edited,
      problems
    }
  }
  save = async (_ref: NoteRef, changes: NoteChanges, baseHash: string): Promise<NoteSaveResult> => {
    this.saves.push({ changes, baseHash })
    if (hash(this.text) !== baseHash) {
      return {
        status: 'conflict',
        disk: { exists: true, content: this.text, hash: hash(this.text) }
      }
    }
    this.text = applyChanges(this.text, changes)
    return { status: 'saved', hash: hash(this.text) }
  }
  onChanged = (listener: (e: NoteChangedEvent) => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

let disk: FakeDisk
let session: NoteSession

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-25T12:00:00Z'))
  disk = new FakeDisk()
  session = new NoteSession(REF, disk)
})
afterEach(async () => {
  await session.dispose()
  vi.useRealTimers()
})

describe('NoteSession', () => {
  it('loads the fields, the text and when the file was last changed', async () => {
    await session.start()
    expect(session.getSnapshot()).toMatchObject({
      status: 'ready',
      meta: { title: 'Methods', group: 'Thesis', subgroup: '', pinned: false },
      body: 'Schools were recruited\n',
      updatedAt: 1_700_000_000_000
    })
  })

  it('saves a field without touching the text, and says the note was just updated', async () => {
    await session.start()
    session.setMeta({ pinned: true })
    await session.flush()
    expect(disk.saves).toHaveLength(1)
    expect(disk.saves[0].changes).toEqual({ meta: { pinned: true } })
    expect(splitNote(disk.text).body).toBe('Schools were recruited\n')
    expect(session.getSnapshot().updatedAt).toBe(Date.now())
    expect(session.getSnapshot().save).toBe('clean')
  })

  it('saves typing after a pause and keeps the fields alone', async () => {
    await session.start()
    session.editBody('New words\n')
    expect(session.getSnapshot().save).toBe('dirty')
    await vi.advanceTimersByTimeAsync(600)
    expect(disk.saves[0].changes).toEqual({ body: 'New words\n' })
    expect(parseMeta(splitNote(disk.text).head).meta.group).toBe('Thesis')
  })

  it('does not overwrite an outside edit: it offers the choice', async () => {
    await session.start()
    disk.text += 'edited elsewhere\n'
    session.editBody('mine\n')
    await session.flush()
    expect(session.getSnapshot().conflict?.body).toContain('edited elsewhere')
    expect(disk.text).toContain('edited elsewhere')
  })
})
