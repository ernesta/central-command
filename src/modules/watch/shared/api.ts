import type {
  CheckOutcome,
  NewWatchSource,
  WatchCounts,
  WatchItem,
  WatchItemsQuery,
  WatchSource,
  WatchSourceChanges,
  WatchState
} from './types'

/** The Watch slice of window.api. */
export interface WatchApi {
  sources: {
    list(): Promise<WatchSource[]>
    add(input: NewWatchSource): Promise<WatchSource>
    update(id: number, changes: WatchSourceChanges): Promise<WatchSource>
    /** Removes the source and the items it announced. */
    remove(id: number): Promise<void>
    /** Sources worth offering that are not being watched yet. */
  }
  items: {
    list(query?: WatchItemsQuery): Promise<WatchItem[]>
    setState(id: number, state: WatchState): Promise<void>
    /** The first look at an item (the page opens it in the browser): a new one becomes seen. */
    open(id: number): Promise<void>
    /** New items become seen (all, or one source's). Returns how many changed. */
    markAllSeen(sourceId?: number): Promise<number>
    /** Saved items with a deadline or event date from today to `days` days on, soonest first. */
    upcoming(days: number): Promise<WatchItem[]>
  }
  /** Check one source, or all of them, now. Resolves when the checks are done. */
  checkNow(sourceId?: number): Promise<CheckOutcome[]>
  counts(): Promise<WatchCounts>
  keywords: {
    get(): Promise<string[]>
    /** Replaces the list (an empty list restores the defaults) and scores what is stored again. */
    set(terms: string[]): Promise<string[]>
  }
  /** Something was checked or changed. Returns an unsubscribe function. */
  onChanged(listener: (counts: WatchCounts) => void): () => void
}

export const WATCH_IPC = {
  sourcesList: 'watch:sources-list',
  sourcesAdd: 'watch:sources-add',
  sourcesUpdate: 'watch:sources-update',
  sourcesRemove: 'watch:sources-remove',
  itemsList: 'watch:items-list',
  itemsSetState: 'watch:items-set-state',
  itemsOpen: 'watch:items-open',
  itemsMarkAllSeen: 'watch:items-mark-all-seen',
  itemsUpcoming: 'watch:items-upcoming',
  checkNow: 'watch:check-now',
  counts: 'watch:counts',
  keywordsGet: 'watch:keywords-get',
  keywordsSet: 'watch:keywords-set',
  changed: 'watch:changed'
} as const
