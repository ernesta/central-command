import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createNoteFileExclusive,
  hashContent,
  readNoteFile,
  renameNoteFileExclusive,
  writeNoteFileGuarded
} from './guarded-file'

let dir: string
let path: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-guarded-'))
  path = join(dir, 'note.md')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('createNoteFileExclusive', () => {
  it('creates a new file with exactly the content, and leaves no temp file', async () => {
    expect(await createNoteFileExclusive(path, 'hello\n')).toBe(true)
    expect(readFileSync(path, 'utf8')).toBe('hello\n')
    expect(readdirSync(dir)).toEqual(['note.md'])
  })

  it('never replaces an existing file', async () => {
    writeFileSync(path, 'precious')
    expect(await createNoteFileExclusive(path, 'other')).toBe(false)
    expect(readFileSync(path, 'utf8')).toBe('precious')
    expect(readdirSync(dir)).toEqual(['note.md'])
  })

  it('creates the folder when needed', async () => {
    const nested = join(dir, 'a', 'b', 'note.md')
    expect(await createNoteFileExclusive(nested, 'x')).toBe(true)
    expect(readFileSync(nested, 'utf8')).toBe('x')
  })
})

describe('writeNoteFileGuarded', () => {
  it('writes when the file still matches the base hash', async () => {
    writeFileSync(path, 'one')
    const { result, wrote } = await writeNoteFileGuarded(path, 'two', hashContent('one'))
    expect(result).toEqual({ status: 'saved', hash: hashContent('two') })
    expect(wrote).toBe(true)
    expect(readFileSync(path, 'utf8')).toBe('two')
  })

  it('refuses, writing nothing, when the file changed since the base hash', async () => {
    writeFileSync(path, 'changed by someone else')
    const { result, wrote } = await writeNoteFileGuarded(path, 'mine', hashContent('one'))
    expect(result.status).toBe('conflict')
    expect(wrote).toBe(false)
    expect(readFileSync(path, 'utf8')).toBe('changed by someone else')
  })

  it('does not write when the disk already holds the content', async () => {
    writeFileSync(path, 'same')
    const { result, wrote } = await writeNoteFileGuarded(path, 'same', 'stale-hash')
    expect(wrote).toBe(false)
    expect(result).toEqual({ status: 'saved', hash: hashContent('same') })
  })

  it('creates a missing file lazily, but never for blank content', async () => {
    const empty = hashContent('')
    expect((await writeNoteFileGuarded(path, '  \n', empty)).wrote).toBe(false)
    expect(readdirSync(dir)).toEqual([])
    expect((await writeNoteFileGuarded(path, 'text', empty)).wrote).toBe(true)
  })

  it('leaves an empty file rather than deleting when a note is cleared', async () => {
    writeFileSync(path, 'text')
    await writeNoteFileGuarded(path, '', hashContent('text'))
    expect(readFileSync(path, 'utf8')).toBe('')
  })

  it('reads a missing file as empty', async () => {
    expect(await readNoteFile(path)).toEqual({ exists: false, content: '', hash: hashContent('') })
  })
})

describe('renameNoteFileExclusive', () => {
  it('moves the file to the new name with its content intact', async () => {
    writeFileSync(path, 'hello')
    const to = join(dir, 'other.md')
    expect(await renameNoteFileExclusive(path, to)).toBe(true)
    expect(readFileSync(to, 'utf8')).toBe('hello')
    expect(readdirSync(dir)).toEqual(['other.md'])
  })

  it('never replaces a file already at the new name, and changes nothing', async () => {
    writeFileSync(path, 'mine')
    const to = join(dir, 'other.md')
    writeFileSync(to, 'theirs')
    expect(await renameNoteFileExclusive(path, to)).toBe(false)
    expect(readFileSync(path, 'utf8')).toBe('mine')
    expect(readFileSync(to, 'utf8')).toBe('theirs')
  })
})
