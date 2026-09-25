import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { SettingsStore } from './settings'

const defaults = defaultSettings('/home/x/CentralCommand/data/zotero-export.bib')
let dir: string
let file: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cc-settings-'))
  file = join(dir, 'settings.json')
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('SettingsStore', () => {
  it('returns defaults when the file does not exist', async () => {
    expect(await new SettingsStore(file, defaults).load()).toEqual(defaults)
  })

  it('persists updates and reloads them', async () => {
    const store = new SettingsStore(file, defaults)
    await store.update({ repoPath: '/work/repo', ui: { workspace: 'work' } })
    const reloaded = await new SettingsStore(file, defaults).load()
    expect(reloaded.repoPath).toBe('/work/repo')
    expect(reloaded.ui.workspace).toBe('work')
    expect(reloaded.zoteroExportPath).toBe(defaults.zoteroExportPath)
  })

  it('keeps a valid terminal choice and falls back to the default for unknown or missing ones', async () => {
    const store = new SettingsStore(file, defaults)
    await store.update({ terminal: 'ghostty' })
    expect((await new SettingsStore(file, defaults).load()).terminal).toBe('ghostty')
    await writeFile(file, JSON.stringify({ terminal: 'hyper' }))
    expect((await new SettingsStore(file, defaults).load()).terminal).toBe(defaults.terminal)
    await writeFile(file, JSON.stringify({ repoPath: '/r' }))
    expect((await new SettingsStore(file, defaults).load()).terminal).toBe(defaults.terminal)
  })

  it('ignores wrongly typed values and keeps defaults for them', async () => {
    await writeFile(
      file,
      JSON.stringify({ zoteroExportPath: 5, repoPath: '/r', ui: { workspace: 'mars' } })
    )
    const s = await new SettingsStore(file, defaults).load()
    expect(s.zoteroExportPath).toBe(defaults.zoteroExportPath)
    expect(s.repoPath).toBe('/r')
    expect(s.ui.workspace).toBe('research')
  })

  it('keeps a sensible training aim and folder, and falls back for anything else', async () => {
    const store = new SettingsStore(file, defaults)
    await store.update({ trainingAimHours: 150, trainingsFolder: '/t' })
    const kept = await new SettingsStore(file, defaults).load()
    expect(kept.trainingAimHours).toBe(150)
    expect(kept.trainingsFolder).toBe('/t')
    for (const bad of [0, -5, 'lots', null, 1e9]) {
      await writeFile(file, JSON.stringify({ trainingAimHours: bad, trainingsFolder: 5 }))
      const s = await new SettingsStore(file, defaults).load()
      expect(s.trainingAimHours).toBe(200)
      expect(s.trainingsFolder).toBe('')
    }
  })

  it('sets a corrupt file aside instead of overwriting it', async () => {
    await writeFile(file, '{ not json')
    const s = await new SettingsStore(file, defaults).load()
    expect(s).toEqual(defaults)
    const files = await readdir(dir)
    const kept = files.find((f) => f.startsWith('settings.json.corrupt-'))
    expect(kept).toBeDefined()
    expect(await readFile(join(dir, kept!), 'utf8')).toBe('{ not json')
  })

  it('stores per-module UI state and keeps it across reloads', async () => {
    const store = new SettingsStore(file, defaults)
    await store.update({ ui: { moduleState: { readings: { view: 'board' } } } })
    await store.update({ ui: { workspace: 'life' } })
    const reloaded = await new SettingsStore(file, defaults).load()
    expect(reloaded.ui.moduleState).toEqual({ readings: { view: 'board' } })
    expect(reloaded.ui.workspace).toBe('life')
  })

  it('ignores malformed module state', async () => {
    await writeFile(file, JSON.stringify({ ui: { moduleState: ['nope'] } }))
    expect((await new SettingsStore(file, defaults).load()).ui.moduleState).toEqual({})
  })

  it('notifies listeners with the new and previous settings after saving', async () => {
    const store = new SettingsStore(file, defaults)
    const calls: [string, string][] = []
    const off = store.onChange((now, before) => calls.push([now.repoPath, before.repoPath]))
    await store.update({ repoPath: '/a' })
    await store.update({ repoPath: '/b' })
    off()
    await store.update({ repoPath: '/c' })
    expect(calls).toEqual([
      ['/a', ''],
      ['/b', '/a']
    ])
  })
})
