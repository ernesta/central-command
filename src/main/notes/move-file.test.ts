import {
  statSync,
  utimesSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { moveNoteFile } from './move-file'

let root: string
let from: string
let to: string
let trashed: string[]
let trashFails: boolean

const trash = async (path: string): Promise<void> => {
  if (trashFails) throw new Error('Trash unavailable')
  trashed.push(readFileSync(path, 'utf8'))
  rmSync(path)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-move-'))
  from = join(root, 'from')
  to = join(root, 'to')
  mkdirSync(from)
  mkdirSync(to)
  writeFileSync(join(from, 'A.md'), 'mine\n')
  trashed = []
  trashFails = false
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const pick = (): Promise<{ id: string; path: string }> => {
  const id = existsSync(join(to, 'A.md')) ? 'A 2' : 'A'
  return Promise.resolve({ id, path: join(to, `${id}.md`) })
}

describe('moveNoteFile', () => {
  it('keeps the original’s modified time, so a move does not look like an edit', async () => {
    const then = new Date('2026-03-04T12:00:00Z')
    utimesSync(join(from, 'A.md'), then, then)
    await moveNoteFile({
      sourcePath: join(from, 'A.md'),
      content: 'mine\n',
      pickTarget: pick,
      trash
    })
    expect(statSync(join(to, 'A.md')).mtimeMs).toBe(then.getTime())
  })

  it('creates the file in the other folder and trashes the original', async () => {
    const id = await moveNoteFile({
      sourcePath: join(from, 'A.md'),
      content: 'mine\n',
      pickTarget: pick,
      trash
    })
    expect(id).toBe('A')
    expect(readFileSync(join(to, 'A.md'), 'utf8')).toBe('mine\n')
    expect(readdirSync(from)).toEqual([])
    expect(trashed).toEqual(['mine\n'])
  })

  it('never replaces a file that is already there', async () => {
    writeFileSync(join(to, 'A.md'), 'theirs\n')
    const id = await moveNoteFile({
      sourcePath: join(from, 'A.md'),
      content: 'mine\n',
      pickTarget: pick,
      trash
    })
    expect(id).toBe('A 2')
    expect(readFileSync(join(to, 'A.md'), 'utf8')).toBe('theirs\n')
    expect(readFileSync(join(to, 'A 2.md'), 'utf8')).toBe('mine\n')
  })

  it('tries again when the name it picked is taken before it can write', async () => {
    let calls = 0
    const id = await moveNoteFile({
      sourcePath: join(from, 'A.md'),
      content: 'mine\n',
      pickTarget: () => {
        calls++
        // The first answer is stale: that file now exists.
        if (calls === 1) writeFileSync(join(to, 'A.md'), 'theirs\n')
        return Promise.resolve({
          id: calls === 1 ? 'A' : 'A 2',
          path: join(to, calls === 1 ? 'A.md' : 'A 2.md')
        })
      },
      trash
    })
    expect(id).toBe('A 2')
    expect(readFileSync(join(to, 'A.md'), 'utf8')).toBe('theirs\n')
  })

  it('leaves the original alone and no second copy when the Trash move fails', async () => {
    trashFails = true
    await expect(
      moveNoteFile({ sourcePath: join(from, 'A.md'), content: 'mine\n', pickTarget: pick, trash })
    ).rejects.toThrow('Trash unavailable')
    expect(readFileSync(join(from, 'A.md'), 'utf8')).toBe('mine\n')
    expect(readdirSync(to)).toEqual([])
  })

  it('does not remove someone else’s file when it has to give up', async () => {
    trashFails = true
    writeFileSync(join(to, 'A.md'), 'theirs\n')
    await expect(
      moveNoteFile({ sourcePath: join(from, 'A.md'), content: 'mine\n', pickTarget: pick, trash })
    ).rejects.toThrow()
    expect(readFileSync(join(to, 'A.md'), 'utf8')).toBe('theirs\n')
  })
})
