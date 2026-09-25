import {
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
import { rewriteNoteFiles } from './rewrite-files'

let root: string
let dir: string
let backupDir: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-rewrite-'))
  dir = join(root, 'notes')
  backupDir = join(root, 'backup')
  mkdirSync(dir)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const swap = (content: string): string => content.replace(/old/g, 'new')

describe('rewriteNoteFiles', () => {
  it('changes only the notes that come out different, after copying each original', async () => {
    writeFileSync(join(dir, 'a.md'), 'old one\n')
    writeFileSync(join(dir, 'b.md'), 'nothing here\n')
    const report = await rewriteNoteFiles({ dir, transform: swap, backupDir })
    expect(report).toEqual({ changed: ['a.md'], skipped: [] })
    expect(readFileSync(join(dir, 'a.md'), 'utf8')).toBe('new one\n')
    expect(readFileSync(join(dir, 'b.md'), 'utf8')).toBe('nothing here\n')
    expect(readdirSync(backupDir)).toEqual(['a.md'])
    expect(readFileSync(join(backupDir, 'a.md'), 'utf8')).toBe('old one\n')
  })

  it('skips and reports a note that changed while it ran, and never overwrites it', async () => {
    writeFileSync(join(dir, 'a.md'), 'old one\n')
    writeFileSync(join(dir, 'b.md'), 'old two\n')
    const report = await rewriteNoteFiles({
      dir,
      backupDir,
      transform: (content) => {
        // Someone edits b.md after it was read for the rewrite but before it is saved.
        if (content === 'old two\n') writeFileSync(join(dir, 'b.md'), 'old two, edited by hand\n')
        return swap(content)
      }
    })
    expect(report).toEqual({ changed: ['a.md'], skipped: ['b.md'] })
    expect(readFileSync(join(dir, 'a.md'), 'utf8')).toBe('new one\n')
    expect(readFileSync(join(dir, 'b.md'), 'utf8')).toBe('old two, edited by hand\n')
  })

  it('ignores hidden files and other file types, and a missing folder', async () => {
    writeFileSync(join(dir, '.hidden.md'), 'old\n')
    writeFileSync(join(dir, 'x.txt'), 'old\n')
    expect(await rewriteNoteFiles({ dir, transform: swap, backupDir })).toEqual({
      changed: [],
      skipped: []
    })
    expect(readFileSync(join(dir, '.hidden.md'), 'utf8')).toBe('old\n')
    expect(existsSync(backupDir)).toBe(false)
    expect(
      await rewriteNoteFiles({ dir: join(root, 'missing'), transform: swap, backupDir })
    ).toEqual({ changed: [], skipped: [] })
  })
})
