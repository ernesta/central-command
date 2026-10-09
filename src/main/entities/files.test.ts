import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { entityFileInfo, listEntityFiles } from './files'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-files-'))
  mkdirSync(join(root, 'research'))
  mkdirSync(join(root, 'research', 'sub'))
  writeFileSync(join(root, 'research', 'Data Sources Summary.xlsx'), 'x'.repeat(2048))
  writeFileSync(join(root, 'research', 'Data Sources Summary.md'), '# note')
  writeFileSync(join(root, 'research', '.hidden.xlsx'), 'x')
  writeFileSync(join(root, 'secret.txt'), 'outside')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('listEntityFiles', () => {
  it('lists files other than notes and hidden files, and skips missing workspaces', async () => {
    expect(await listEntityFiles(root)).toEqual([
      {
        key: 'research/Data Sources Summary.xlsx',
        name: 'Data Sources Summary.xlsx',
        workspace: 'research',
        size: 2048
      }
    ])
  })
})

describe('entityFileInfo', () => {
  it('finds a listed file', async () => {
    expect((await entityFileInfo(root, 'research/Data Sources Summary.xlsx'))?.size).toBe(2048)
  })
  it('says null for a missing file, a note, a folder and a hidden file', async () => {
    expect(await entityFileInfo(root, 'research/Gone.xlsx')).toBeNull()
    expect(await entityFileInfo(root, 'research/Data Sources Summary.md')).toBeNull()
    expect(await entityFileInfo(root, 'research/sub')).toBeNull()
    expect(await entityFileInfo(root, 'research/.hidden.xlsx')).toBeNull()
  })
  it('never leaves the notes folder', async () => {
    expect(await entityFileInfo(root, '../secret.txt')).toBeNull()
    expect(await entityFileInfo(root, 'research/../secret.txt')).toBeNull()
    expect(await entityFileInfo(root, '/etc/hosts')).toBeNull()
    expect(await entityFileInfo(root, 'secret.txt')).toBeNull()
    symlinkSync(join(root, 'secret.txt'), join(root, 'research', 'link.txt'))
    expect(await entityFileInfo(root, 'research/link.txt')).toBeNull()
    expect((await listEntityFiles(root)).map((f) => f.name)).not.toContain('link.txt')
  })
})
