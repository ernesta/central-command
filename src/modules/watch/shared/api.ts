import type {
  CheckOutcome,
  EntryLinkRead,
  ManualItemInput,
  NewWatchSource,
  WatchCounts,
  WatchItem,
  WatchItemsQuery,
  WatchSource,
  WatchSourceChanges,
  WatchState,
  WatchWorkspace
} from './types'

/** The Watch slice of window.api. */
export interface WatchApi {
  sources: {
    /** One workspace's sources, or every workspace's (Settings). */
    list(workspace?: WatchWorkspace): Promise<WatchSource[]>
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
    /** New items become seen (all, one source's, or one workspace's). Returns how many changed. */
    markAllSeen(sourceId?: number, workspace?: WatchWorkspace): Promise<number>
    /** Saved items with a deadline or event date from today to `days` days on, soonest first (one workspace's, or all). */
    upcoming(days: number, workspace?: WatchWorkspace): Promise<WatchItem[]>
    /** An entry added by hand: created Saved, in its section. */
    createManual(input: ManualItemInput): Promise<WatchItem>
    updateManual(id: number, input: ManualItemInput): Promise<WatchItem>
    /** Deletes an entry added by hand and returns it, so that Undo can `restoreManual` it. */
    deleteManual(id: number): Promise<WatchItem>
    restoreManual(item: WatchItem): Promise<WatchItem>
    /** Reads the page a pasted link points to, once, to fill the New entry dialog (one request to that public address). */
    readLink(url: string): Promise<EntryLinkRead>
  }
  /** Check one source, or all of them (one workspace's, when it is given), now. Resolves when the checks are done. */
  checkNow(sourceId?: number, workspace?: WatchWorkspace): Promise<CheckOutcome[]>
  counts(workspace?: WatchWorkspace): Promise<WatchCounts>
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
  itemsCreateManual: 'watch:items-create-manual',
  itemsUpdateManual: 'watch:items-update-manual',
  itemsDeleteManual: 'watch:items-delete-manual',
  itemsRestoreManual: 'watch:items-restore-manual',
  itemsReadLink: 'watch:items-read-link',
  checkNow: 'watch:check-now',
  counts: 'watch:counts',
  keywordsGet: 'watch:keywords-get',
  keywordsSet: 'watch:keywords-set',
  changed: 'watch:changed'
} as const
