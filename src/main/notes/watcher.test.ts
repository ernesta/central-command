import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeFileAtomic } from '../atomic-write'
import { NotesWatcher } from './watcher'

let dir: string
let watcher: NotesWatcher
let seen: string[]
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cc-nwatch-'))
  seen = []
  watcher = new NotesWatcher({ dir, onNoteChanged: (name) => seen.push(name), stabilityMs: 100 })
  watcher.start()
  await sleep(300)
})
afterEach(async () => {
  await watcher.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('NotesWatcher', () => {
  it('reports a note created by another tool', async () => {
    writeFileSync(join(dir, 'smith2020.md'), '# Notes')
    await vi.waitFor(() => expect(seen).toContain('smith2020.md'), { timeout: 4000 })
  })

  it('reports edits and removals', async () => {
    const file = join(dir, 'a.md')
    writeFileSync(file, 'one')
    await vi.waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(1), { timeout: 4000 })
    seen.length = 0
    writeFileSync(file, 'two')
    await vi.waitFor(() => expect(seen).toContain('a.md'), { timeout: 4000 })
    seen.length = 0
    unlinkSync(file)
    await vi.waitFor(() => expect(seen).toContain('a.md'), { timeout: 4000 })
  })

  it('reports the app’s own atomic saves once, under the real name, never the temp file', async () => {
    await writeFileAtomic(join(dir, 'b.md'), 'saved by the app')
    await vi.waitFor(() => expect(seen).toContain('b.md'), { timeout: 4000 })
    await sleep(400)
    expect(seen.every((name) => name === 'b.md')).toBe(true)
  })

  it('ignores files that are not notes', async () => {
    writeFileSync(join(dir, 'readme.txt'), 'x')
    writeFileSync(join(dir, '.hidden.md'), 'x')
    await sleep(700)
    expect(seen).toEqual([])
  })

  it('can be closed twice', async () => {
    await watcher.close()
    await watcher.close()
  })
})
