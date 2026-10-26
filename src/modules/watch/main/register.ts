import { BrowserWindow, ipcMain, net } from 'electron'
import type { MainContext, MainModule } from '../../main-registry'
import { WATCH_IPC } from '../shared/api'
import {
  WATCH_KINDS,
  WATCH_METHODS,
  WATCH_STATES,
  type NewWatchSource,
  type WatchCounts,
  type WatchItemsQuery,
  type WatchSourceChanges,
  type WatchState
} from '../shared/types'
import { rescoreItems } from './checker'
import { watchMigrations } from './migrations'
import { makeNetFetcher } from './net-fetcher'
import {
  addSource,
  getCounts,
  getKeywords,
  listItems,
  listSources,
  markAllSeen,
  openItem,
  removeSource,
  setItemState,
  setKeywords,
  updateSource,
  upcoming
} from './repository'
import { WatchScheduler } from './scheduler'

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${what}`)
  return value as Record<string, unknown>
}
const asId = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error('Invalid id')
  return value
}
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

function asNewSource(value: unknown): NewWatchSource {
  const o = asObject(value, 'source')
  const kind = str(o.kind)
  const method = str(o.method)
  if (!kind || !(WATCH_KINDS as readonly string[]).includes(kind)) throw new Error('Invalid kind')
  if (!method || !(WATCH_METHODS as readonly string[]).includes(method))
    throw new Error('Invalid method')
  return {
    title: str(o.title) ?? '',
    url: str(o.url) ?? '',
    kind: kind as NewWatchSource['kind'],
    method: method as NewWatchSource['method'],
    issn: str(o.issn) ?? null,
    groupLabel: str(o.groupLabel),
    taskUid: str(o.taskUid) ?? null,
    intervalHours: typeof o.intervalHours === 'number' ? o.intervalHours : undefined
  }
}

function asChanges(value: unknown): WatchSourceChanges {
  const o = asObject(value, 'changes')
  const out: WatchSourceChanges = {}
  if (str(o.title) !== undefined) out.title = str(o.title)
  if (str(o.url) !== undefined) out.url = str(o.url)
  if (str(o.kind) !== undefined) out.kind = str(o.kind) as WatchSourceChanges['kind']
  if (str(o.groupLabel) !== undefined) out.groupLabel = str(o.groupLabel)
  if (typeof o.intervalHours === 'number') out.intervalHours = o.intervalHours
  if (typeof o.active === 'boolean') out.active = o.active
  return out
}

function asQuery(value: unknown): WatchItemsQuery {
  if (value === undefined || value === null) return {}
  const o = asObject(value, 'query')
  const state = str(o.state)
  if (
    state !== undefined &&
    state !== 'open' &&
    state !== 'undismissed' &&
    !(WATCH_STATES as readonly string[]).includes(state)
  )
    throw new Error('Invalid state')
  const kind = str(o.kind)
  if (kind !== undefined && !(WATCH_KINDS as readonly string[]).includes(kind))
    throw new Error('Invalid kind')
  return {
    state: state as WatchItemsQuery['state'],
    kind: kind as WatchItemsQuery['kind'],
    sourceId: typeof o.sourceId === 'number' ? o.sourceId : undefined,
    relevantOnly: o.relevantOnly === true,
    limit: typeof o.limit === 'number' ? o.limit : undefined
  }
}

function register({ db }: MainContext): () => void {
  const broadcast = (counts: WatchCounts): void => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(WATCH_IPC.changed, counts)
  }
  const scheduler = new WatchScheduler({
    db,
    fetcher: makeNetFetcher((url, init) => net.fetch(url, init)),
    onChange: () => broadcast(getCounts(db))
  })
  const now = (): string => new Date().toISOString()
  const today = (): string => now().slice(0, 10)

  ipcMain.handle(WATCH_IPC.sourcesList, () => listSources(db))
  ipcMain.handle(WATCH_IPC.sourcesAdd, (_e, input: unknown) => {
    const source = addSource(db, asNewSource(input), now())
    broadcast(getCounts(db))
    return source
  })
  ipcMain.handle(WATCH_IPC.sourcesUpdate, (_e, id: unknown, changes: unknown) =>
    updateSource(db, asId(id), asChanges(changes))
  )
  ipcMain.handle(WATCH_IPC.sourcesRemove, (_e, id: unknown) => {
    removeSource(db, asId(id))
    broadcast(getCounts(db))
  })
  ipcMain.handle(WATCH_IPC.itemsList, (_e, query: unknown) => listItems(db, asQuery(query)))
  ipcMain.handle(WATCH_IPC.itemsSetState, (_e, id: unknown, state: unknown) => {
    if (typeof state !== 'string' || !(WATCH_STATES as readonly string[]).includes(state))
      throw new Error('Invalid state')
    setItemState(db, asId(id), state as WatchState)
    broadcast(getCounts(db))
  })
  ipcMain.handle(WATCH_IPC.itemsOpen, (_e, id: unknown) => {
    openItem(db, asId(id))
    broadcast(getCounts(db))
  })
  ipcMain.handle(WATCH_IPC.itemsMarkAllSeen, (_e, sourceId: unknown) => {
    const changed = markAllSeen(db, sourceId === undefined ? undefined : asId(sourceId))
    broadcast(getCounts(db))
    return changed
  })
  ipcMain.handle(WATCH_IPC.itemsUpcoming, (_e, days: unknown) =>
    upcoming(db, today(), typeof days === 'number' ? days : 60)
  )
  ipcMain.handle(WATCH_IPC.checkNow, (_e, sourceId: unknown) =>
    scheduler.checkNow(sourceId === undefined ? undefined : asId(sourceId))
  )
  ipcMain.handle(WATCH_IPC.counts, () => getCounts(db))
  ipcMain.handle(WATCH_IPC.keywordsGet, () => getKeywords(db))
  ipcMain.handle(WATCH_IPC.keywordsSet, (_e, terms: unknown) => {
    if (!Array.isArray(terms) || !terms.every((t) => typeof t === 'string'))
      throw new Error('Invalid keywords')
    const saved = setKeywords(db, terms)
    rescoreItems(db)
    broadcast(getCounts(db))
    return saved
  })

  // With no source nothing is ever requested.
  scheduler.start()
  return () => scheduler.stop()
}

export const watchMainModule: MainModule = {
  id: 'watch',
  migrations: watchMigrations,
  register
}
