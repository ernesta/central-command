import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileAtomic } from './atomic-write'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cc-atomic-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('writeFileAtomic', () => {
  it('creates missing parent directories and writes the contents', async () => {
    const target = join(dir, 'a', 'b', 'file.md')
    await writeFileAtomic(target, '# Hello')
    expect(await readFile(target, 'utf8')).toBe('# Hello')
  })

  it('replaces existing contents and leaves no temp files behind', async () => {
    const target = join(dir, 'file.md')
    await writeFileAtomic(target, 'one')
    await writeFileAtomic(target, 'two')
    expect(await readFile(target, 'utf8')).toBe('two')
    expect(await readdir(dir)).toEqual(['file.md'])
  })
})
