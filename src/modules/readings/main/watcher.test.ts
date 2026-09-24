import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportWatcher } from './watcher'

let dir: string
let watcher: ExportWatcher
let onChange: ReturnType<typeof vi.fn<() => void>>
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-watch-'))
  onChange = vi.fn<() => void>()
  watcher = new ExportWatcher({ onChange, stabilityMs: 150 })
})
afterEach(async () => {
  await watcher.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('ExportWatcher', () => {
  it('fires when the file is created after watching began', async () => {
    const file = join(dir, 'export.bib')
    await watcher.watch(file)
    await sleep(100)
    writeFileSync(file, '@article{a, title = {A}}')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 4000 })
  })

  it('fires when an existing file changes, but not for the initial state', async () => {
    const file = join(dir, 'export.bib')
    writeFileSync(file, 'one')
    await watcher.watch(file)
    await sleep(400)
    expect(onChange).not.toHaveBeenCalled()
    writeFileSync(file, 'two')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 4000 })
  })

  it('waits for a burst of writes to finish and fires once', async () => {
    const file = join(dir, 'export.bib')
    writeFileSync(file, 'start')
    await watcher.watch(file)
    await sleep(300)
    for (let i = 0; i < 4; i++) {
      appendFileSync(file, `piece ${i}\n`)
      await sleep(30)
    }
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 4000 })
    await sleep(600)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('stops watching the old path when re-pointed', async () => {
    const first = join(dir, 'first.bib')
    const second = join(dir, 'second.bib')
    writeFileSync(first, 'x')
    writeFileSync(second, 'x')
    await watcher.watch(first)
    await watcher.watch(second)
    await sleep(300)
    writeFileSync(first, 'changed')
    await sleep(700)
    expect(onChange).not.toHaveBeenCalled()
    writeFileSync(second, 'changed')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 4000 })
  })

  it('does nothing for an empty path and can be closed twice', async () => {
    await watcher.watch('')
    await watcher.close()
    await watcher.close()
    expect(onChange).not.toHaveBeenCalled()
  })
})
