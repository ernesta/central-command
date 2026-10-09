import { lstat, readdir } from 'fs/promises'
import { basename, join } from 'path'
import { isSafeFileKey, type EntityFile } from '@shared/entity-files'

/** The workspace folders that hold files; a note's own `.md` files are not files in this sense. */
const WORKSPACES = ['research', 'work', 'life']

const isLinkable = (name: string): boolean => !name.startsWith('.') && !name.endsWith('.md')

/** Every file a note can link to: the files directly in a workspace's notes folder, except notes and hidden files. */
export async function listEntityFiles(noteFiles: string): Promise<EntityFile[]> {
  const found: EntityFile[] = []
  for (const workspace of WORKSPACES) {
    let entries
    try {
      entries = await readdir(join(noteFiles, workspace), { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    for (const entry of entries) {
      if (!entry.isFile() || !isLinkable(entry.name)) continue
      const { size } = await lstat(join(noteFiles, workspace, entry.name))
      found.push({ key: `${workspace}/${entry.name}`, name: entry.name, workspace, size })
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}

/** One linkable file by its key, or null when the key is not safe, is not a file, or is gone. */
export async function entityFileInfo(noteFiles: string, key: string): Promise<EntityFile | null> {
  const parts = key.split('/')
  if (!isSafeFileKey(key) || parts.length !== 2 || !WORKSPACES.includes(parts[0])) return null
  if (!isLinkable(parts[1])) return null
  try {
    const info = await lstat(join(noteFiles, key))
    if (!info.isFile()) return null
    return { key, name: basename(key), workspace: parts[0], size: info.size }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}
