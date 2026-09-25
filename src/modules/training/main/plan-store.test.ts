import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hashContent } from '../../../main/notes/guarded-file'
import { PlanStore } from './plan-store'

let dir: string
let store: PlanStore
const file = join('Training plan 2026-27.md')

beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), 'plan-')), 'plans')
  store = new PlanStore(dir)
})
afterEach(() => rmSync(join(dir, '..'), { recursive: true, force: true }))

describe('PlanStore', () => {
  it('reads a missing plan as empty and creates it (with its folder) on the first save', async () => {
    const empty = await store.read(2026)
    expect(empty.exists).toBe(false)
    const saved = await store.write(2026, '## Priority 1\n', empty.hash)
    expect(saved.status).toBe('saved')
    expect(readFileSync(join(dir, file), 'utf8')).toBe('## Priority 1\n')
    expect((await store.read(2026)).exists).toBe(true)
  })

  it('keeps each academic year in its own file', async () => {
    const { hash } = await store.read(2026)
    await store.write(2026, 'a', hash)
    expect((await store.read(2027)).exists).toBe(false)
  })

  it('never overwrites a plan that changed since the editor loaded it', async () => {
    const first = await store.write(2026, 'mine', (await store.read(2026)).hash)
    expect(first.status).toBe('saved')
    writeFileSync(join(dir, file), 'edited elsewhere')
    const result = await store.write(2026, 'stale save', hashContent('mine'))
    expect(result.status).toBe('conflict')
    expect(readFileSync(join(dir, file), 'utf8')).toBe('edited elsewhere')
  })

  it('does not create a file for whitespace', async () => {
    await store.write(2026, '  \n', (await store.read(2026)).hash)
    expect(existsSync(join(dir, file))).toBe(false)
  })
})
