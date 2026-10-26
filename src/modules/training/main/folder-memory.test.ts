import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FolderMemory, listLinkedFolder } from './folder-memory'
import { resolveInside } from './files'
import { trainingMigrations } from './migrations'

let base: string
let root: string
let memory: FolderMemory
beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'cc-memory-')))
  root = join(base, 'Trainings')
  mkdirSync(join(root, '2026-27', 'Workshops', 'RSA'), { recursive: true })
  mkdirSync(join(root, '2026-27', 'Other'), { recursive: true })
  writeFileSync(join(root, '2026-27', 'Workshops', 'RSA', 'slides.pdf'), 'x')
  const db = new Database(':memory:')
  for (const m of trainingMigrations) db.exec(m.sql)
  memory = new FolderMemory(db)
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const FOLDER = '2026-27/Workshops/RSA'

describe('listLinkedFolder', () => {
  it('lists a folder that is there and remembers it', async () => {
    const res = await listLinkedFolder(root, FOLDER, '', memory)
    expect(res.status).toBe('ok')
    expect(res.movedTo).toBeUndefined()
    expect(memory.get(FOLDER)).not.toBeNull()
  })

  it('follows a renamed folder', async () => {
    await listLinkedFolder(root, FOLDER, '', memory)
    renameSync(join(root, FOLDER), join(root, '2026-27', 'Workshops', 'Response Surface'))
    const res = await listLinkedFolder(root, FOLDER, '', memory)
    expect(res.movedTo).toBe('2026-27/Workshops/Response Surface')
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['slides.pdf'])
    expect(memory.get(FOLDER)).toBeNull()
    expect(memory.get('2026-27/Workshops/Response Surface')).not.toBeNull()
  })

  it('follows a moved folder, and the sub-folder with it', async () => {
    mkdirSync(join(root, FOLDER, 'extra'))
    await listLinkedFolder(root, FOLDER, '', memory)
    renameSync(join(root, FOLDER), join(root, '2026-27', 'Other', 'RSA'))
    const res = await listLinkedFolder(root, FOLDER, 'extra', memory)
    expect(res.movedTo).toBe('2026-27/Other/RSA')
    expect(res.status).toBe('ok')
  })

  it('finds a folder that was renamed before it was ever remembered when its name is unique', async () => {
    renameSync(join(root, FOLDER), join(root, '2026-27', 'Other', 'RSA'))
    const res = await listLinkedFolder(root, FOLDER, '', memory)
    expect(res.movedTo).toBe('2026-27/Other/RSA')
  })

  it('does not guess when the name is not unique', async () => {
    mkdirSync(join(root, 'a', 'RSA'), { recursive: true })
    mkdirSync(join(root, 'b', 'RSA'), { recursive: true })
    rmSync(join(root, FOLDER), { recursive: true })
    const res = await listLinkedFolder(root, FOLDER, '', memory)
    expect(res.status).toBe('missing')
    expect(res.movedTo).toBeUndefined()
  })

  it('keeps the link when nothing fits', async () => {
    await listLinkedFolder(root, FOLDER, '', memory)
    rmSync(join(root, FOLDER), { recursive: true })
    const res = await listLinkedFolder(root, FOLDER, '', memory)
    expect(res).toEqual({ status: 'missing' })
    expect(memory.get(FOLDER)).not.toBeNull()
  })

  it('does not take a different folder that now has the old path for a move', async () => {
    await listLinkedFolder(root, FOLDER, '', memory)
    rmSync(join(root, FOLDER), { recursive: true })
    mkdirSync(join(root, FOLDER))
    const res = await listLinkedFolder(root, FOLDER, '', memory)
    expect(res.status).toBe('ok')
    expect(res.movedTo).toBeUndefined()
  })
})

describe('an absolute link', () => {
  const absolute = (): string => join(root, FOLDER)

  it('is listed and remembered without any root', async () => {
    const res = await listLinkedFolder('', absolute(), '', memory)
    expect(res.status).toBe('ok')
    expect(memory.get(absolute())).not.toBeNull()
  })

  it('follows a rename next to it, answering with an absolute path', async () => {
    await listLinkedFolder('', absolute(), '', memory)
    const renamed = join(root, '2026-27', 'Workshops', 'Response Surface')
    renameSync(absolute(), renamed)
    const res = await listLinkedFolder('', absolute(), '', memory)
    expect(res.movedTo).toBe(renamed)
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['slides.pdf'])
  })

  it('does not look beyond the folder that held it', async () => {
    await listLinkedFolder('', absolute(), '', memory)
    const elsewhere = join(root, '2026-27', 'Other', 'RSA')
    renameSync(absolute(), elsewhere)
    mkdirSync(join(root, '2026-27', 'Workshops', 'Nothing'))
    const res = await listLinkedFolder('', absolute(), '', memory)
    expect(res.status).toBe('missing')
  })
})

describe('resolveInside', () => {
  it('says a missing folder is not there, in words', async () => {
    await expect(resolveInside(root, '2026-27/Nope')).rejects.toThrow(
      '“Nope” is not there. It may have been moved or renamed.'
    )
  })
})
