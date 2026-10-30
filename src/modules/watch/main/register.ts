import { BrowserWindow, ipcMain, net } from 'electron'
import type { MainContext, MainModule } from '../../main-registry'
import { WATCH_IPC } from '../shared/api'
import {
  WATCH_METHODS,
  WATCH_SECTIONS,
  WATCH_STATES,
  WATCH_WORKSPACES,
  type ManualItemInput,
  type NewWatchSource,
  type WatchItem,
  type WatchCounts,
  type WatchItemsQuery,
  type WatchSourceChanges,
  type WatchState,
  type WatchWorkspace
} from '../shared/types'
import { rescoreItems } from './checker'
import { readEntryLink } from './entry-link'
import { watchMigrations } from './migrations'
import { makeNetFetcher } from './net-fetcher'
import {
  addSource,
  createManualItem,
  deleteManualItem,
  getCounts,
  getKeywords,
  itemsByIds,
  listItems,
  listSources,
  markAllSeen,
  openItem,
  reclassifyItems,
  removeSource,
  restoreManualItem,
  setItemState,
  setKeywords,
  updateManualItem,
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
/** A workspace argument: absent means every workspace's. */
function asWorkspace(value: unknown): WatchWorkspace | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !(WATCH_WORKSPACES as readonly string[]).includes(value))
    throw new Error('Invalid workspace')
  return value as WatchWorkspace
}

function asNewSource(value: unknown): NewWatchSource {
  const o = asObject(value, 'source')
  const method = str(o.method)
  if (!method || !(WATCH_METHODS as readonly string[]).includes(method))
    throw new Error('Invalid method')
  return {
    workspace: asWorkspace(o.workspace),
    title: str(o.title) ?? '',
    url: str(o.url) ?? '',
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
  const workspace = asWorkspace(o.workspace)
  if (workspace) out.workspace = workspace
  if (str(o.title) !== undefined) out.title = str(o.title)
  if (str(o.url) !== undefined) out.url = str(o.url)
  if (str(o.groupLabel) !== undefined) out.groupLabel = str(o.groupLabel)
  if (typeof o.intervalHours === 'number') out.intervalHours = o.intervalHours
  if (typeof o.active === 'boolean') out.active = o.active
  const method = str(o.method)
  if (method !== undefined) {
    if (!(WATCH_METHODS as readonly string[]).includes(method)) throw new Error('Invalid method')
    out.method = method as WatchSourceChanges['method']
  }
  return out
}

const nullableString = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

function asManualItem(value: unknown): ManualItemInput {
  const o = asObject(value, 'entry')
  const section = str(o.section)
  if (!section || !(WATCH_SECTIONS as readonly string[]).includes(section))
    throw new Error('Invalid section')
  return {
    workspace: asWorkspace(o.workspace),
    title: str(o.title) ?? '',
    section: section as ManualItemInput['section'],
    url: str(o.url),
    summary: str(o.summary),
    eventDate: nullableString(o.eventDate),
    eventEnd: nullableString(o.eventEnd),
    deadline: nullableString(o.deadline),
    deadlineLabel: nullableString(o.deadlineLabel)
  }
}

function asQuery(value: unknown): WatchItemsQuery {
  if (value === undefined || value === null) return {}
  const o = asObject(value, 'query')
  const state = str(o.state)
  if (
    state !== undefined &&
    state !== 'open' &&
    !(WATCH_STATES as readonly string[]).includes(state)
  )
    throw new Error('Invalid state')
  const section = str(o.section)
  if (section !== undefined && !(WATCH_SECTIONS as readonly string[]).includes(section))
    throw new Error('Invalid section')
  return {
    workspace: asWorkspace(o.workspace),
    state: state as WatchItemsQuery['state'],
    section: section as WatchItemsQuery['section'],
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
  // Sections come from each item's own words: stored ones are recomputed at launch (entries by hand keep the user's choice).
  reclassifyItems(db)
  const fetcher = makeNetFetcher((url, init) => net.fetch(url, init))
  const scheduler = new WatchScheduler({
    db,
    fetcher,
    onChange: () => broadcast(getCounts(db))
  })
  const now = (): string => new Date().toISOString()
  const today = (): string => now().slice(0, 10)

  ipcMain.handle(WATCH_IPC.sourcesList, (_e, workspace: unknown) =>
    listSources(db, asWorkspace(workspace))
  )
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
  ipcMain.handle(WATCH_IPC.itemsGet, (_e, id: unknown) => itemsByIds(db, [asId(id)])[0] ?? null)
  ipcMain.handle(WATCH_IPC.itemsSetState, (_e, id: unknown, state: unknown, readAt: unknown) => {
    if (typeof state !== 'string' || !(WATCH_STATES as readonly string[]).includes(state))
      throw new Error('Invalid state')
    if (readAt !== undefined && readAt !== null && typeof readAt !== 'string')
      throw new Error('Invalid date')
    setItemState(db, asId(id), state as WatchState, { readAt, now: now() })
    broadcast(getCounts(db))
  })
  ipcMain.handle(WATCH_IPC.itemsOpen, (_e, id: unknown) => {
    openItem(db, asId(id), now())
    broadcast(getCounts(db))
  })
  ipcMain.handle(WATCH_IPC.itemsMarkAllSeen, (_e, sourceId: unknown, workspace: unknown) => {
    const changed = markAllSeen(
      db,
      sourceId === undefined ? undefined : asId(sourceId),
      asWorkspace(workspace),
      now()
    )
    broadcast(getCounts(db))
    return changed
  })
  ipcMain.handle(WATCH_IPC.itemsUpcoming, (_e, days: unknown, workspace: unknown) =>
    upcoming(db, today(), typeof days === 'number' ? days : 60, 50, asWorkspace(workspace))
  )
  ipcMain.handle(WATCH_IPC.itemsCreateManual, (_e, input: unknown) => {
    const item = createManualItem(db, asManualItem(input), now())
    broadcast(getCounts(db))
    return item
  })
  ipcMain.handle(WATCH_IPC.itemsUpdateManual, (_e, id: unknown, input: unknown) => {
    const item = updateManualItem(db, asId(id), asManualItem(input))
    broadcast(getCounts(db))
    return item
  })
  ipcMain.handle(WATCH_IPC.itemsDeleteManual, (_e, id: unknown) => {
    const item = deleteManualItem(db, asId(id))
    broadcast(getCounts(db))
    return item
  })
  ipcMain.handle(WATCH_IPC.itemsRestoreManual, (_e, item: unknown) => {
    const o = asObject(item, 'entry') as unknown as WatchItem
    const restored = restoreManualItem(db, o, now())
    broadcast(getCounts(db))
    return restored
  })
  ipcMain.handle(WATCH_IPC.itemsReadLink, (_e, url: unknown) => {
    if (typeof url !== 'string') throw new Error('Invalid address')
    return readEntryLink(url, fetcher, today())
  })
  ipcMain.handle(WATCH_IPC.checkNow, (_e, sourceId: unknown, workspace: unknown) =>
    scheduler.checkNow(sourceId === undefined ? undefined : asId(sourceId), asWorkspace(workspace))
  )
  ipcMain.handle(WATCH_IPC.counts, (_e, workspace: unknown) =>
    getCounts(db, asWorkspace(workspace))
  )
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
