import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PeopleStore } from './people-store'

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-people-'))
  file = join(dir, 'people.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('PeopleStore', () => {
  it('starts empty when there is no file, and writes nothing until a change', async () => {
    const store = new PeopleStore(file)
    expect(await store.load()).toEqual([])
    expect(existsSync(file)).toBe(false)
  })

  it('saves each change and loads it back', async () => {
    const store = new PeopleStore(file)
    await store.load()
    await store.add({ name: 'Kathy Rastle' })
    await store.add({ name: 'Ernesta Orlovaitė', me: true })
    await store.update('Kathy Rastle', { initials: 'KAT' })
    const reloaded = new PeopleStore(file)
    expect(await reloaded.load()).toEqual([
      { name: 'Kathy Rastle', initials: 'KAT', me: false },
      { name: 'Ernesta Orlovaitė', initials: 'EO', me: true }
    ])
  })

  it('keeps the file and the in-memory list unchanged when a change is refused', async () => {
    const store = new PeopleStore(file)
    await store.add({ name: 'Kathy Rastle' })
    const before = readFileSync(file, 'utf8')
    await expect(store.add({ name: 'Karl Rowe', initials: 'KR' })).rejects.toThrow('already used')
    expect(readFileSync(file, 'utf8')).toBe(before)
    expect(store.list()).toHaveLength(1)
  })

  it('sets a corrupt file aside instead of overwriting it', async () => {
    writeFileSync(file, '{ not json')
    const store = new PeopleStore(file)
    expect(await store.load()).toEqual([])
    const files = readdirSync(dir)
    expect(files.some((f) => f.startsWith('people.json.corrupt-'))).toBe(true)
    expect(existsSync(file)).toBe(false)
  })

  it('hands out copies, so callers cannot edit the list behind its back', async () => {
    const store = new PeopleStore(file)
    await store.add({ name: 'Kathy Rastle' })
    store.list()[0].initials = 'ZZ'
    expect(store.list()[0].initials).toBe('KR')
  })
})

describe('PeopleStore.remove', () => {
  it('removes a person and keeps the change', async () => {
    const store = new PeopleStore(file)
    await store.add({ name: 'Kathy Rastle' })
    await store.add({ name: 'Ernesta Orlovaitė' })
    await store.remove('Kathy Rastle')
    expect(await new PeopleStore(file).load()).toEqual([
      { name: 'Ernesta Orlovaitė', initials: 'EO', me: false }
    ])
  })
  it('refuses an unknown person and leaves the file as it was', async () => {
    const store = new PeopleStore(file)
    await store.add({ name: 'Kathy Rastle' })
    const before = readFileSync(file, 'utf8')
    await expect(store.remove('Nobody')).rejects.toThrow('not in the list')
    expect(readFileSync(file, 'utf8')).toBe(before)
  })
})
