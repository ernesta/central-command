import Database from 'better-sqlite3'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { SyncStatus } from '../shared/types'
import { readingsMigrations } from './migrations'
import { getCounts } from './repository'
import { SyncService } from './sync-service'

const FIXTURE = join(__dirname, '../../../../tests/fixtures/readings-sample.bib')

let dir: string
let bibPath: string
let db: Database.Database
let service: SyncService

const snapshot = (): unknown => db.prepare('SELECT * FROM readings ORDER BY id').all()
const runCount = (): number =>
  (db.prepare('SELECT COUNT(*) AS n FROM sync_runs').get() as { n: number }).n

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-sync-'))
  bibPath = join(dir, 'export.bib')
  db = new Database(':memory:')
  runMigrations(db, readingsMigrations)
  service = new SyncService({ db, getExportPath: () => bibPath })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('SyncService: success', () => {
  it('imports the fixture and records an ok run with counts', async () => {
    copyFileSync(FIXTURE, bibPath)
    const status = await service.sync()
    expect(status.state).toBe('idle')
    expect(status.message).toBeNull()
    expect(status.lastRun).toMatchObject({
      status: 'ok',
      entriesSeen: 15,
      inserted: 15,
      updated: 0,
      flaggedMissing: 0
    })
    expect(status.lastSuccessAt).toBe(status.lastRun?.finishedAt)
    expect(getCounts(db).total).toBe(15)
    expect(runCount()).toBe(1)
  })

  it('is idempotent: a second sync of the same file changes no readings', async () => {
    copyFileSync(FIXTURE, bibPath)
    await service.sync()
    const before = snapshot()
    const status = await service.sync()
    expect(status.lastRun).toMatchObject({ inserted: 0, updated: 0, flaggedMissing: 0 })
    expect(snapshot()).toEqual(before)
  })

  it('flags readings removed from the export and un-flags them when they return', async () => {
    copyFileSync(FIXTURE, bibPath)
    await service.sync()
    writeFileSync(
      bibPath,
      '@article{vaswaniAttentionAllYou2017, title = {Attention Is All You Need}, author = {Vaswani, Ashish}, date = {2017-06-12}, keywords = {transformers,nlp,read}, abstract = {The dominant sequence transduction models are based on complex recurrent networks.}}'
    )
    const status = await service.sync()
    expect(status.lastRun).toMatchObject({ entriesSeen: 1, flaggedMissing: 14 })
    expect(getCounts(db)).toMatchObject({ total: 15, missingFromSource: 14 })
    copyFileSync(FIXTURE, bibPath)
    await service.sync()
    expect(getCounts(db)).toMatchObject({ total: 15, missingFromSource: 0 })
  })

  it('picks up a changed export path on the next sync', async () => {
    const other = join(dir, 'other.bib')
    copyFileSync(FIXTURE, other)
    const moving = new SyncService({ db, getExportPath: () => other })
    expect((await moving.sync()).state).toBe('idle')
    expect(getCounts(db).total).toBe(15)
  })
})

describe('SyncService: not set up', () => {
  it('reports not_configured for a missing file, without an error or a recorded run', async () => {
    const status = await service.sync()
    expect(status).toMatchObject({ state: 'not_configured', message: null, lastRun: null })
    expect(runCount()).toBe(0)
  })

  it('becomes idle once the file appears', async () => {
    await service.sync()
    copyFileSync(FIXTURE, bibPath)
    expect((await service.sync()).state).toBe('idle')
  })
})

describe('SyncService: failures leave data untouched', () => {
  beforeEach(async () => {
    copyFileSync(FIXTURE, bibPath)
    await service.sync()
  })

  it('a half-written file records an error and changes no readings', async () => {
    const before = snapshot()
    writeFileSync(bibPath, '@article{a, title = {Cut off mid-wri')
    const status = await service.sync()
    expect(status.state).toBe('error')
    expect(status.message).toMatch(/parse error/i)
    expect(status.lastRun).toMatchObject({ status: 'error' })
    expect(status.lastSuccessAt).not.toBeNull()
    expect(snapshot()).toEqual(before)
    expect(getCounts(db).missingFromSource).toBe(0)
  })

  it('an empty file is an error, not a reason to flag everything missing', async () => {
    const before = snapshot()
    writeFileSync(bibPath, '')
    const status = await service.sync()
    expect(status.state).toBe('error')
    expect(status.message).toMatch(/no entries/)
    expect(snapshot()).toEqual(before)
  })

  it('an unreadable path (a directory) is an error', async () => {
    const before = snapshot()
    const dirService = new SyncService({ db, getExportPath: () => dir })
    const status = await dirService.sync()
    expect(status.state).toBe('error')
    expect(status.message).toMatch(/Couldn't read/)
    expect(snapshot()).toEqual(before)
  })

  it('recovers on the next good sync', async () => {
    writeFileSync(bibPath, 'garbage {')
    expect((await service.sync()).state).toBe('error')
    copyFileSync(FIXTURE, bibPath)
    const status = await service.sync()
    expect(status.state).toBe('idle')
    expect(status.message).toBeNull()
  })
})

describe('SyncService: status and concurrency', () => {
  it('notifies listeners: syncing, then the result', async () => {
    copyFileSync(FIXTURE, bibPath)
    const seen: SyncStatus['state'][] = []
    const off = service.onStatusChange((s) => seen.push(s.state))
    await service.sync()
    off()
    await service.sync()
    expect(seen).toEqual(['syncing', 'idle'])
  })

  it('never overlaps: a burst of triggers runs at most one extra pass', async () => {
    copyFileSync(FIXTURE, bibPath)
    const states: string[] = []
    service.onStatusChange((s) => states.push(s.state))
    await Promise.all([service.sync(), service.sync(), service.sync(), service.sync()])
    expect(states.filter((s) => s === 'syncing').length).toBeLessThanOrEqual(2)
    expect(runCount()).toBeLessThanOrEqual(2)
    expect(getCounts(db).total).toBe(15)
  })

  it('derives its starting status from recorded runs', async () => {
    copyFileSync(FIXTURE, bibPath)
    await service.sync()
    expect(new SyncService({ db, getExportPath: () => bibPath }).status()).toMatchObject({
      state: 'idle',
      lastRun: { status: 'ok', entriesSeen: 15 }
    })
    writeFileSync(bibPath, '@article{x, title = {oops')
    await service.sync()
    expect(new SyncService({ db, getExportPath: () => bibPath }).status()).toMatchObject({
      state: 'error'
    })
  })
})
