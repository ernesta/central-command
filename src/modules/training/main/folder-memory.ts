import type { Database } from 'better-sqlite3'
import { readdir, realpath, stat } from 'fs/promises'
import { dirname, join } from 'path'
import { listFolder, NotThereError, resolveInside, type FolderListing } from './files'

/** A folder's identity on disk: it survives a rename or a move on the same disk. */
export interface FolderIdentity {
  dev: string
  ino: string
}

/** Where linked folders were last seen (table `training_folder_memory`). */
export class FolderMemory {
  constructor(private readonly db: Database) {}

  get(folder: string): FolderIdentity | null {
    const row = this.db
      .prepare('SELECT dev, ino FROM training_folder_memory WHERE folder = ?')
      .get(folder) as FolderIdentity | undefined
    return row ?? null
  }

  set(folder: string, id: FolderIdentity): void {
    this.db
      .prepare(
        `INSERT INTO training_folder_memory (folder, dev, ino) VALUES (@folder, @dev, @ino)
         ON CONFLICT(folder) DO UPDATE SET dev = excluded.dev, ino = excluded.ino`
      )
      .run({ folder, ...id })
  }

  forget(folder: string): void {
    this.db.prepare('DELETE FROM training_folder_memory WHERE folder = ?').run(folder)
  }
}

/** The most folders and the deepest level a search for a moved folder looks at, starting in the folder that held it. */
const MAX_FOLDERS = 5000
const MAX_DEPTH = 3

const identityOf = (info: { dev: bigint; ino: bigint }): FolderIdentity => ({
  dev: String(info.dev),
  ino: String(info.ino)
})

/** The identity of the folder at `folder`, or null when it is not there. */
async function currentIdentity(folder: string): Promise<FolderIdentity | null> {
  try {
    const info = await stat(await resolveInside(folder), { bigint: true })
    return info.isDirectory() ? identityOf(info) : null
  } catch (error) {
    if (error instanceof NotThereError || (error as NodeJS.ErrnoException).code === 'ENOENT')
      return null
    throw error
  }
}

/**
 * Where the folder went: the one beside where it was (in the folder that held it, a few levels down) with
 * the remembered identity, or failing that the only folder with the same name. Symbolic links are not
 * followed, hidden folders are skipped, and the search stops after a fixed number of folders, so a huge
 * tree cannot hold it up. Null when nothing fits.
 */
export async function findMoved(
  folder: string,
  remembered: FolderIdentity | null
): Promise<string | null> {
  let parent: string
  try {
    parent = await realpath(dirname(folder))
  } catch {
    return null
  }
  const name = folder.split('/').at(-1)
  let byIdentity: string | null = null
  const sameName: string[] = []
  let seen = 0
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (byIdentity !== null || depth > MAX_DEPTH) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (byIdentity !== null || seen >= MAX_FOLDERS) return
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      seen += 1
      const path = join(dir, entry.name)
      if (remembered) {
        try {
          const info = await stat(path, { bigint: true })
          if (String(info.ino) === remembered.ino && String(info.dev) === remembered.dev) {
            byIdentity = path
            return
          }
        } catch {
          continue
        }
      }
      if (entry.name === name) sameName.push(path)
      await walk(path, depth + 1)
    }
  }
  await walk(parent, 1)
  const found = byIdentity ?? (sameName.length === 1 ? sameName[0] : null)
  if (found === null) return null
  return found === folder ? null : found
}

export type LinkedListing = FolderListing & {
  /** Set when the linked folder had moved or been renamed: its new path. The caller saves it as the link. */
  movedTo?: string
}

/**
 * `listFolder`, plus a memory of where the folder is. A folder that is there is remembered; one that is
 * not is looked for by what it was, and when found its listing comes with the new path to link.
 */
export async function listLinkedFolder(
  folder: string,
  sub: string,
  memory: FolderMemory
): Promise<LinkedListing> {
  const listing = await listFolder(folder, sub)
  const here = await currentIdentity(folder)
  if (here) {
    memory.set(folder, here)
    return listing
  }
  const moved = await findMoved(folder, memory.get(folder))
  if (moved === null) return listing
  const after = await listFolder(moved, sub)
  const identity = await currentIdentity(moved)
  if (identity) memory.set(moved, identity)
  memory.forget(folder)
  return { ...after, movedTo: moved }
}
