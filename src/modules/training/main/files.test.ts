import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilesError, listFolder, openablePath, relativeToRoot, resolveInside } from './files'

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

  it('reports an unset or missing root and a missing folder without throwing', async () => {
    expect(await listFolder('', FOLDER)).toEqual({ status: 'no-root' })
    expect(await listFolder(join(base, 'nope'), FOLDER)).toEqual({ status: 'no-root' })
    expect(await listFolder(root, '2025-26/Gone')).toEqual({ status: 'missing' })
  })

  it('refuses .. and absolute paths', async () => {
    await expect(listFolder(root, '../Secrets')).rejects.toBeInstanceOf(FilesError)
    await expect(listFolder(root, FOLDER, '../../../../Secrets')).rejects.toBeInstanceOf(FilesError)
    await expect(listFolder(root, outside)).rejects.toBeInstanceOf(FilesError)
  })

  it('refuses a folder that is a symlink leading outside the root, and hides such links in a listing', async () => {
    symlinkSync(outside, join(root, '2025-26', 'escape'))
    await expect(listFolder(root, '2025-26/escape')).rejects.toBeInstanceOf(FilesError)
    symlinkSync(outside, join(root, '2025-26', 'SEDarc', 'Day one', 'linked'))
    symlinkSync(
      join(outside, 'passwords.txt'),
      join(root, '2025-26', 'SEDarc', 'Day one', 'pw.txt')
    )
    const res = await listFolder(root, FOLDER)
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['slides', 'notes.pdf'])
  })

  it('allows a symlink that stays inside the root', async () => {
    symlinkSync(join(root, '2025-26', 'SEDarc', 'Day one'), join(root, 'shortcut'))
    const res = await listFolder(root, 'shortcut')
    expect(res.status).toBe('ok')
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

describe('resolveInside and relativeToRoot', () => {
  it('needs a root', async () => {
    await expect(resolveInside('', FOLDER)).rejects.toBeInstanceOf(FilesError)
    await expect(relativeToRoot('', root)).rejects.toBeInstanceOf(FilesError)
  })

  it('turns a picked folder into a path relative to the root, refusing others', async () => {
    expect(await relativeToRoot(root, join(root, '2025-26', 'SEDarc', 'Day one'))).toBe(FOLDER)
    await expect(relativeToRoot(root, outside)).rejects.toBeInstanceOf(FilesError)
    await expect(relativeToRoot(root, root)).rejects.toBeInstanceOf(FilesError)
    symlinkSync(outside, join(root, 'escape'))
    await expect(relativeToRoot(root, join(root, 'escape'))).rejects.toBeInstanceOf(FilesError)
  })

  it('does not treat a sibling with the same prefix as inside', async () => {
    const sibling = join(base, 'Trainings-old')
    mkdirSync(sibling)
    await expect(relativeToRoot(root, sibling)).rejects.toBeInstanceOf(FilesError)
  })
})
