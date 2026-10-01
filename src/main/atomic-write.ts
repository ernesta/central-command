import { mkdir, rename, writeFile, rm } from 'fs/promises'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname, basename, join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Write a file so readers never see a half-written result: write to a temp
 * file in the same directory, then rename over the target (atomic on the
 * same filesystem).
 */
export async function writeFileAtomic(path: string, contents: string): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    await writeFile(tmp, contents, 'utf8')
    await rename(tmp, path)
  } catch (error) {
    await rm(tmp, { force: true })
    throw error
  }
}

/** The synchronous twin, for the few writes that must be on disk before the call returns (see the time store). */
export function writeFileAtomicSync(path: string, contents: string): void {
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true })
  const tmp = join(dir, `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    writeFileSync(tmp, contents, 'utf8')
    renameSync(tmp, path)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw error
  }
}
