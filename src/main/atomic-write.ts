import { mkdir, rename, writeFile, rm } from 'fs/promises'
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
