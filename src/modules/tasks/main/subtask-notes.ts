import type Database from 'better-sqlite3'
import type { Task } from '../shared/types'
import { TasksStore } from './tasks-store'

/** A live subtask that holds a note, with the live parent it would move to. */
export interface NoteMove {
  kidUid: string
  kidTitle: string
  note: string
  parentUid: string
  parentTitle: string
}

/** The text a parent's description gets for one subtask's note: a `### <title>` section after what is there. */
export function appendSection(description: string, title: string, note: string): string {
  const section = `### ${title.trim() || 'Untitled'}\n\n${note.trim()}`
  const base = description.replace(/\s+$/, '')
  return base === '' ? section : `${base}\n\n${section}`
}

/** Every live subtask under a live parent whose description is not blank, parents and siblings in their own order. */
export function findNoteMoves(db: Database.Database): NoteMove[] {
  const rows = db
    .prepare(
      `SELECT k.uid AS kidUid, k.title AS kidTitle, k.description AS note, p.uid AS parentUid, p.title AS parentTitle
         FROM tasks k JOIN tasks p ON p.uid = k.parent_uid
         WHERE k.deleted_at IS NULL AND p.deleted_at IS NULL AND k.description <> ''
         ORDER BY p.title, p.uid, k.position, k.uid`
    )
    .all() as NoteMove[]
  return rows.filter((m) => m.note.trim() !== '')
}

/**
 * Move the notes in one transaction: each parent's description only grows (the existing text is kept byte for byte at its start),
 * the subtask's own is cleared only after its note is found in the parent's new text. Any failure rolls everything back.
 */
export function applyNoteMoves(db: Database.Database, moves: NoteMove[]): void {
  const store = new TasksStore(db)
  const need = (uid: string): Task => {
    const t = store.get(uid)
    if (!t) throw new Error(`Task ${uid} is gone`)
    return t
  }
  db.transaction(() => {
    for (const m of moves) {
      const parent = need(m.parentUid)
      const kid = need(m.kidUid)
      if (kid.description !== m.note) throw new Error(`“${m.kidTitle}” changed since the plan`)
      const next = appendSection(parent.description, m.kidTitle, m.note)
      if (!next.startsWith(parent.description.replace(/\s+$/, ''))) {
        throw new Error(`“${m.parentTitle}” would lose text`)
      }
      store.update(m.parentUid, { description: next })
      if (!need(m.parentUid).description.includes(m.note.trim())) {
        throw new Error(`The note of “${m.kidTitle}” did not reach “${m.parentTitle}”`)
      }
      store.update(m.kidUid, { description: '' })
    }
  })()
}
