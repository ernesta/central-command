import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilesError, isSafeFolder, listFolder, openablePath, resolveInside } from './files'

let base: string
let folder: string
let outside: string
beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'cc-files-')))
  folder = join(base, 'Slides', 'Day one')
  outside = join(base, 'Secrets')
  mkdirSync(join(folder, 'slides'), { recursive: true })
  mkdirSync(outside)
  writeFileSync(join(folder, 'notes.pdf'), 'pdf')
  writeFileSync(join(folder, '.DS_Store'), 'x')
  writeFileSync(join(folder, 'slides', 'deck.pptx'), 'ppt')
  writeFileSync(join(outside, 'passwords.txt'), 'secret')
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('listFolder', () => {
  it('lists one level of any folder, folders first, leaving out hidden files', async () => {
    expect(await listFolder(folder)).toEqual({
      status: 'ok',
      entries: [
        { name: 'slides', kind: 'folder', size: null },
        { name: 'notes.pdf', kind: 'file', size: 3 }
      ]
    })
  })

  it('lists a sub-folder', async () => {
    const res = await listFolder(folder, 'slides')
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['deck.pptx'])
  })

  it('calls a missing folder, and an old relative link, missing without throwing', async () => {
    expect(await listFolder(join(base, 'Gone'))).toEqual({ status: 'missing' })
    expect(await listFolder('2025-26/SEDarc/Day one')).toEqual({ status: 'missing' })
  })

  it('refuses .. in a folder, a sub-folder and an absolute sub-path', async () => {
    await expect(listFolder(`${folder}/../../Secrets`)).rejects.toBeInstanceOf(FilesError)
    await expect(listFolder(folder, '../../../Secrets')).rejects.toBeInstanceOf(FilesError)
    await expect(listFolder(folder, outside)).rejects.toBeInstanceOf(FilesError)
  })

  it('hides links that lead out of the linked folder, and refuses to open into them', async () => {
    symlinkSync(outside, join(folder, 'slides', 'escape'))
    await expect(listFolder(folder, 'slides/escape')).rejects.toBeInstanceOf(FilesError)
    symlinkSync(outside, join(folder, 'linked'))
    symlinkSync(join(outside, 'passwords.txt'), join(folder, 'pw.txt'))
    const res = await listFolder(folder)
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['slides', 'notes.pdf'])
  })

  it('follows a link that is itself the linked folder, and one that stays inside it', async () => {
    symlinkSync(folder, join(base, 'shortcut'))
    expect((await listFolder(join(base, 'shortcut'))).status).toBe('ok')
    symlinkSync(join(folder, 'slides'), join(folder, 'inner'))
    const res = await listFolder(folder)
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toContain('inner')
  })
})

describe('openablePath', () => {
  it('resolves a file inside the folder', async () => {
    expect(await openablePath(folder, '', 'notes.pdf')).toBe(join(folder, 'notes.pdf'))
  })

  it('refuses a file link that leads outside, a name with .., a folder, and files that run code', async () => {
    symlinkSync(join(outside, 'passwords.txt'), join(folder, 'pw.txt'))
    await expect(openablePath(folder, '', 'pw.txt')).rejects.toBeInstanceOf(FilesError)
    await expect(openablePath(folder, '', '../../Secrets/passwords.txt')).rejects.toBeInstanceOf(
      FilesError
    )
    await expect(openablePath(folder, '', 'slides')).rejects.toBeInstanceOf(FilesError)
    writeFileSync(join(folder, 'run.command'), '#!/bin/sh')
    await expect(openablePath(folder, '', 'run.command')).rejects.toThrow('not opened')
  })
})

describe('resolveInside and isSafeFolder', () => {
  it('needs an absolute path', async () => {
    await expect(resolveInside('2025-26/SEDarc/Day one')).rejects.toThrow('not there')
    expect(await resolveInside(folder)).toBe(folder)
  })

  it('accepts an absolute folder and refuses the unsafe', () => {
    expect(isSafeFolder('/Users/me/Slides/Day one')).toBe(true)
    for (const bad of ['', '~/x', '../up', '/a/../../b', 'a\\..\\b', 'a\u0000b']) {
      expect(isSafeFolder(bad)).toBe(false)
    }
  })
})
