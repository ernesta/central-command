import type { Database } from 'better-sqlite3'
import { stat } from 'fs/promises'
import { join } from 'path'
import type { EntityFile } from '@shared/entity-files'
import { entityFileInfo, listEntityFiles } from './files'

interface Identity {
  dev: string
  ino: string
}

/** Where the files notes link to were last seen (table `entity_file_memory`). */
export class FileMemory {
  constructor(private readonly db: Database) {}

  get(key: string): Identity | null {
    const row = this.db
      .prepare('SELECT dev, ino FROM entity_file_memory WHERE key = ?')
      .get(key) as Identity | undefined
    return row ?? null
  }

  set(key: string, id: Identity): void {
    const known = this.get(key)
    if (known && known.dev === id.dev && known.ino === id.ino) return
    this.db
      .prepare(
        `INSERT INTO entity_file_memory (key, dev, ino) VALUES (@key, @dev, @ino)
         ON CONFLICT(key) DO UPDATE SET dev = excluded.dev, ino = excluded.ino`
      )
      .run({ key, ...id })
  }

  forget(key: string): void {
    this.db.prepare('DELETE FROM entity_file_memory WHERE key = ?').run(key)
  }
}

async function identityOf(noteFiles: string, key: string): Promise<Identity | null> {
  try {
    const info = await stat(join(noteFiles, key), { bigint: true })
    return { dev: String(info.dev), ino: String(info.ino) }
  } catch {
    return null
  }
}

export interface ResolvedFile {
  file: EntityFile | null
  /** Set when the file had been renamed or moved and was found again: the key the notes still carry. */
  movedFrom?: string
}

/**
 * `entityFileInfo`, plus a memory of where the file is. A file that is there is remembered; one that is not is
 * looked for by what it was (its identity on disk), and failing that by its name when exactly one file has it.
 * Two or none means no guess.
 */
export async function resolveEntityFile(
  noteFiles: string,
  key: string,
  memory: FileMemory
): Promise<ResolvedFile> {
  const file = await entityFileInfo(noteFiles, key)
  if (file) {
    const id = await identityOf(noteFiles, key)
    if (id) memory.set(key, id)
    return { file }
  }
  const remembered = memory.get(key)
  const all = await listEntityFiles(noteFiles)
  let found: EntityFile | undefined
  if (remembered) {
    for (const candidate of all) {
      const id = await identityOf(noteFiles, candidate.key)
      if (id && id.dev === remembered.dev && id.ino === remembered.ino) {
        found = candidate
        break
      }
    }
  }
  if (!found) {
    const name = key.split('/').at(-1)
    const same = all.filter((f) => f.name === name)
    if (same.length === 1) found = same[0]
  }
  if (!found || found.key === key) return { file: null }
  const id = await identityOf(noteFiles, found.key)
  if (id) memory.set(found.key, id)
  memory.forget(key)
  return { file: found, movedFrom: key }
}
