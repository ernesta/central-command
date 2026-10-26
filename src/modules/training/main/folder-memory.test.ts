import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
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
  mkdirSync(join(root, 'Workshops', 'RSA'), { recursive: true })
  writeFileSync(join(root, 'Workshops', 'RSA', 'slides.pdf'), 'x')
  const db = new Database(':memory:')
  for (const m of trainingMigrations) db.exec(m.sql)
  memory = new FolderMemory(db)
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const folder = (): string => join(root, 'Workshops', 'RSA')

describe('listLinkedFolder', () => {
  it('lists a folder that is there and remembers it', async () => {
    const res = await listLinkedFolder(folder(), '', memory)
    expect(res.status).toBe('ok')
    expect(res.movedTo).toBeUndefined()
    expect(memory.get(folder())).not.toBeNull()
  })

  it('follows a renamed folder, answering with an absolute path', async () => {
    await listLinkedFolder(folder(), '', memory)
    const renamed = join(root, 'Workshops', 'Response Surface')
    renameSync(folder(), renamed)
    const res = await listLinkedFolder(folder(), '', memory)
    expect(res.movedTo).toBe(renamed)
    expect(res.status === 'ok' && res.entries.map((e) => e.name)).toEqual(['slides.pdf'])
    expect(memory.get(folder())).toBeNull()
    expect(memory.get(renamed)).not.toBeNull()
  })

  it('follows a folder moved a level down, and the sub-folder with it', async () => {
    mkdirSync(join(folder(), 'extra'))
    await listLinkedFolder(folder(), '', memory)
    const moved = join(root, 'Workshops', 'Other', 'RSA')
    mkdirSync(dirname(moved))
    renameSync(folder(), moved)
    const res = await listLinkedFolder(folder(), 'extra', memory)
    expect(res.movedTo).toBe(moved)
    expect(res.status).toBe('ok')
  })

  it('finds a folder that was renamed before it was ever remembered when its name is unique', async () => {
    const moved = join(root, 'Workshops', 'Other', 'RSA')
    mkdirSync(dirname(moved))
    renameSync(folder(), moved)
    const res = await listLinkedFolder(folder(), '', memory)
    expect(res.movedTo).toBe(moved)
  })

  it('does not guess when the name is not unique', async () => {
    mkdirSync(join(root, 'Workshops', 'a', 'RSA'), { recursive: true })
    mkdirSync(join(root, 'Workshops', 'b', 'RSA'), { recursive: true })
    rmSync(folder(), { recursive: true })
    const res = await listLinkedFolder(folder(), '', memory)
    expect(res.status).toBe('missing')
    expect(res.movedTo).toBeUndefined()
  })

  it('keeps the link when nothing fits', async () => {
    await listLinkedFolder(folder(), '', memory)
    rmSync(folder(), { recursive: true })
    expect(await listLinkedFolder(folder(), '', memory)).toEqual({ status: 'missing' })
    expect(memory.get(folder())).not.toBeNull()
  })

  it('does not take a different folder that now has the old path for a move', async () => {
    await listLinkedFolder(folder(), '', memory)
    rmSync(folder(), { recursive: true })
    mkdirSync(folder())
    const res = await listLinkedFolder(folder(), '', memory)
    expect(res.status).toBe('ok')
    expect(res.movedTo).toBeUndefined()
  })

  it('does not look beyond the folder that held it', async () => {
    await listLinkedFolder(folder(), '', memory)
    const elsewhere = join(root, 'Other', 'RSA')
    mkdirSync(dirname(elsewhere))
    renameSync(folder(), elsewhere)
    const res = await listLinkedFolder(folder(), '', memory)
    expect(res.status).toBe('missing')
  })
})

describe('resolveInside', () => {
  it('says a missing folder is not there, in words', async () => {
    await expect(resolveInside(join(root, 'Nope'))).rejects.toThrow(
      '“Nope” is not there. It may have been moved or renamed.'
    )
  })
})
