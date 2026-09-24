import { readdir } from 'fs/promises'
import type { Database } from 'better-sqlite3'
import type { NoteContent, NoteWriteResult } from '@shared/notes'
import { markdownToExcerpt } from '../../../main/notes/excerpt'
import { readNoteFile, writeNoteFileGuarded } from '../../../main/notes/guarded-file'
import { noteBaseName, noteFileName, notePath } from './notes-path'

interface NotesStoreOptions {
  db: Database
  /** Folder holding one `<citekey>.md` per reading. */
  notesDir: string
}

/**
 * Reads and writes each reading's Markdown notes file, and keeps the `has_notes` /
 * `notes_excerpt` caches in the database in step with what is on disk.
 *
 * The files are the source of truth and may be edited by other tools (for example
 * Claude Code), so a write only goes through if the file still holds what the editor
 * last saw. A note is never deleted, and never overwritten behind the user's back.
 */
export class NotesStore {
  private readonly db: Database
  private readonly notesDir: string

  constructor({ db, notesDir }: NotesStoreOptions) {
    this.db = db
    this.notesDir = notesDir
  }

  read(citekey: string): Promise<NoteContent> {
    return readNoteFile(notePath(this.notesDir, citekey))
  }

  /**
   * Save `content`, provided the file on disk still matches `baseHash` (what the editor
   * loaded or last saved). The file is created lazily and never deleted; see `writeNoteFileGuarded`.
   */
  async write(citekey: string, content: string, baseHash: string): Promise<NoteWriteResult> {
    if (!this.readingExists(citekey)) throw new Error(`Unknown reading: ${citekey}`)

    const { result, wrote } = await writeNoteFileGuarded(
      notePath(this.notesDir, citekey),
      content,
      baseHash
    )
    if (wrote) this.updateCache(citekey, content)
    return result
  }

  /** Recompute one reading's caches from its file on disk. */
  async reindex(citekey: string): Promise<void> {
    const { content } = await this.read(citekey)
    this.updateCache(citekey, content)
  }

  /** Reindex the reading that owns `fileName` (e.g. "smith2020.md"), if any. */
  async reindexFile(fileName: string): Promise<string | null> {
    const citekey = this.citekeys().find((key) => noteFileName(key) === fileName)
    if (!citekey) return null
    await this.reindex(citekey)
    return citekey
  }

  /** Bring every reading's caches in line with the notes folder, e.g. at startup. */
  async reindexAll(): Promise<void> {
    let files: Set<string>
    try {
      files = new Set((await readdir(this.notesDir)).filter((f) => f.endsWith('.md')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      files = new Set()
    }
    for (const citekey of this.citekeys()) {
      if (files.has(`${noteBaseName(citekey)}.md`)) await this.reindex(citekey)
      else this.updateCache(citekey, '')
    }
  }

  private citekeys(): string[] {
    return (this.db.prepare('SELECT citekey FROM readings').all() as { citekey: string }[]).map(
      (r) => r.citekey
    )
  }

  private readingExists(citekey: string): boolean {
    return this.db.prepare('SELECT 1 FROM readings WHERE citekey = ?').get(citekey) !== undefined
  }

  private updateCache(citekey: string, content: string): void {
    const hasNotes = content.trim() !== '' ? 1 : 0
    const excerpt = hasNotes ? markdownToExcerpt(content) : ''
    this.db
      .prepare(
        `UPDATE readings SET has_notes = ?, notes_excerpt = ?
         WHERE citekey = ? AND (has_notes <> ? OR notes_excerpt <> ?)`
      )
      .run(hasNotes, excerpt, citekey, hasNotes, excerpt)
  }
}
