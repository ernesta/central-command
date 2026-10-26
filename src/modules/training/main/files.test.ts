import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilesError, isSafeFolder, listFolder, openablePath, resolveInside } from './files'

let base: string
let root: string
let outside: string
beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'cc-files-')))
  root = join(base, 'Trainings')
  outside = join(base, 'Secrets')
  mkdirSync(join(root, '2025-26', 'SEDarc', 'Day one', 'slides'), { recursive: true })
  mkdirSync(outside)
  writeFileSync(join(root, '2025-26', 'SEDarc', 'Day one', 'notes.pdf'), 'pdf')
  writeFileSync(join(root, '2025-26', 'SEDarc', 'Day one', '.DS_Store'), 'x')
  writeFileSync(join(root, '2025-26', 'SEDarc', 'Day one', 'slides', 'deck.pptx'), 'ppt')
  writeFileSync(join(outside, 'passwords.txt'), 'secret')
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const FOLDER = '2025-26/SEDarc/Day one'

describe('listFolder', () => {
  it('lists one level, folders first, leaving out hidden files', async () => {
    const res = await listFolder(root, FOLDER)
    expect(res).toEqual({
      status: 'ok',
      entries: [
        { name: 'slides', kind: 'folder', size: null },
        { name: 'notes.pdf', kind: 'file', size: 3 }
      ]
    })
  })

  it('lists a sub-folder', async () => {
    const res = await listFolder(root, FOLDER, 'slides')
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['deck.pptx'])
  })

  it('lists any folder given as an absolute path, whatever the old setting says', async () => {
    const res = await listFolder('', join(root, FOLDER))
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['slides', 'notes.pdf'])
    const elsewhere = await listFolder(root, outside)
    expect(elsewhere.status === 'ok' && elsewhere.entries.map((e) => e.name)).toEqual([
      'passwords.txt'
    ])
  })

  it('reads a relative link against the old setting, and calls it missing when none is set', async () => {
    expect(await listFolder('', FOLDER)).toEqual({ status: 'missing' })
    expect(await listFolder(join(base, 'nope'), FOLDER)).toEqual({ status: 'missing' })
    expect(await listFolder(root, '2025-26/Gone')).toEqual({ status: 'missing' })
    expect(await listFolder(root, join(base, 'Gone'))).toEqual({ status: 'missing' })
  })

  it('refuses .. in a folder, a sub-folder and a name', async () => {
    await expect(listFolder(root, '../Secrets')).rejects.toBeInstanceOf(FilesError)
    await expect(listFolder(root, `${root}/../Secrets`)).rejects.toBeInstanceOf(FilesError)
    await expect(listFolder(root, FOLDER, '../../../../Secrets')).rejects.toBeInstanceOf(FilesError)
    await expect(listFolder(root, join(root, FOLDER), '/etc')).rejects.toBeInstanceOf(FilesError)
  })

  it('hides links that lead out of the linked folder, and refuses to open into them', async () => {
    symlinkSync(outside, join(root, '2025-26', 'SEDarc', 'Day one', 'slides', 'escape'))
    await expect(listFolder(root, FOLDER, 'slides/escape')).rejects.toBeInstanceOf(FilesError)
    symlinkSync(outside, join(root, '2025-26', 'SEDarc', 'Day one', 'linked'))
    symlinkSync(
      join(outside, 'passwords.txt'),
      join(root, '2025-26', 'SEDarc', 'Day one', 'pw.txt')
    )
    const res = await listFolder(root, FOLDER)
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['slides', 'notes.pdf'])
  })

  it('follows a link that is itself the linked folder, and one that stays inside it', async () => {
    symlinkSync(join(root, '2025-26', 'SEDarc', 'Day one'), join(root, 'shortcut'))
    expect((await listFolder(root, 'shortcut')).status).toBe('ok')
    symlinkSync(
      join(root, '2025-26', 'SEDarc', 'Day one', 'slides'),
      join(root, '2025-26', 'SEDarc', 'Day one', 'inner')
    )
    const res = await listFolder(root, join(root, FOLDER))
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toContain('inner')
  })
})

describe('openablePath', () => {
  it('resolves a file inside the folder', async () => {
    expect(await openablePath(root, FOLDER, '', 'notes.pdf')).toBe(
      join(root, '2025-26', 'SEDarc', 'Day one', 'notes.pdf')
    )
  })

  it('refuses a file link that leads outside, a name with .., a folder, and files that run code', async () => {
    symlinkSync(
      join(outside, 'passwords.txt'),
      join(root, '2025-26', 'SEDarc', 'Day one', 'pw.txt')
    )
    await expect(openablePath(root, FOLDER, '', 'pw.txt')).rejects.toBeInstanceOf(FilesError)
    await expect(
      openablePath(root, FOLDER, '', '../../../../Secrets/passwords.txt')
    ).rejects.toBeInstanceOf(FilesError)
    await expect(openablePath(root, FOLDER, '', 'slides')).rejects.toBeInstanceOf(FilesError)
    writeFileSync(join(root, '2025-26', 'SEDarc', 'Day one', 'run.command'), '#!/bin/sh')
    await expect(openablePath(root, FOLDER, '', 'run.command')).rejects.toThrow('not opened')
  })
})

describe('resolveInside and isSafeFolder', () => {
  it('needs a root only for a relative link', async () => {
    await expect(resolveInside('', FOLDER)).rejects.toBeInstanceOf(FilesError)
    expect(await resolveInside('', join(root, FOLDER))).toBe(join(root, FOLDER))
  })

  it('accepts an absolute or relative folder and refuses the unsafe', () => {
    expect(isSafeFolder('/Users/me/Slides/Day one')).toBe(true)
    expect(isSafeFolder('2025-26/SEDarc/Day one')).toBe(true)
    for (const bad of ['', '~/x', '../up', '/a/../../b', 'a\\..\\b', 'a\u0000b']) {
      expect(isSafeFolder(bad)).toBe(false)
    }
  })
})
