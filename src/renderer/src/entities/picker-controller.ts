import type { EntityRef } from '@shared/entities'
import type { EntityHost, MentionTarget, Suggestion } from './mention-target'
import type { CopyPart } from '@shared/entity-copy'
import {
  entityProviders,
  providerFor,
  type EntityHit,
  type EntityProvider,
  type EntitySelf
} from './registry'
import { EntityResolver, type Resolved } from './resolver'

/** The picker's rows for one kind of entity. */
export interface PickerGroup {
  provider: Pick<EntityProvider, 'kind' | 'heading' | 'icon'>
  hits: EntityHit[]
}

/** What the picker looks like right now; a new object whenever anything in it changes. */
export interface PickerSnapshot {
  open: boolean
  /** Where the cursor is on screen (viewport pixels): the picker sits just under it. */
  left: number
  top: number
  query: string
  groups: PickerGroup[]
  /** Index into the rows of all groups, top to bottom. */
  active: number
  /** A search is under way and nothing has come back yet. */
  loading: boolean
  /** Something went wrong picking (for example a note that changed while it was linked). */
  error: string | null
}

const CLOSED: PickerSnapshot = {
  open: false,
  left: 0,
  top: 0,
  query: '',
  groups: [],
  active: 0,
  loading: false,
  error: null
}

const PER_KIND = 5
const DEBOUNCE_MS = 120

/**
 * The `@` picker and the mentions' resolver for one editor, as one plain object the editor plugins talk to and React
 * reads (`useSyncExternalStore`). Keeping the state here rather than in components means the key handler always sees
 * the current rows, however often React has rendered.
 */
export class EntityPickerController implements EntityHost {
  private target: MentionTarget | null = null
  private snapshot: PickerSnapshot = CLOSED
  private readonly listeners = new Set<() => void>()
  private suggestion: Suggestion | null = null
  /** The `@` the user pressed Escape on: not offered again until that `@` is gone. */
  private dismissedFrom: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private searchToken = 0
  private readonly resolver = new EntityResolver()
  /** The note or meeting being edited, so it is not offered as a link to itself. */
  private self: EntitySelf | null = null

  setSelf = (self: EntitySelf | null): void => {
    this.self = self
  }

  constructor() {
    this.resolver.subscribe(() => {
      this.target?.refresh()
    })
  }

  // --- for React ---------------------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): PickerSnapshot => this.snapshot

  private set(next: Partial<PickerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next }
    for (const listener of this.listeners) listener()
  }

  /** Every row, top to bottom, with the kind it belongs to. */
  private rows(): { hit: EntityHit }[] {
    return this.snapshot.groups.flatMap((g) => g.hits.map((hit) => ({ hit })))
  }

  // --- for the editor plugins --------------------------------------------------------------------

  resolve = (ref: EntityRef): Resolved => this.resolver.get(ref)

  copyPart = async (ref: EntityRef, label: string): Promise<CopyPart | null> => {
    try {
      return (await providerFor(ref.kind)?.copy?.(ref.key, label)) ?? null
    } catch {
      return null
    }
  }

  /** For the hover card: called when something a mention points at has been looked up. */
  subscribeResolved = (listener: () => void): (() => void) => this.resolver.subscribe(listener)

  suggest = (target: MentionTarget, suggestion: Suggestion | null): void => {
    this.target = target
    if (!suggestion) {
      this.dismissedFrom = null
      this.suggestion = null
      if (this.snapshot.open) this.close()
      return
    }
    if (suggestion.from === this.dismissedFrom) return
    const changed =
      !this.suggestion ||
      this.suggestion.from !== suggestion.from ||
      this.suggestion.query !== suggestion.query
    this.suggestion = suggestion
    const caret = target.coordsAt(suggestion.to)
    if (!changed && this.snapshot.open) {
      if (caret.left !== this.snapshot.left || caret.bottom + 6 !== this.snapshot.top) {
        this.set({ left: caret.left, top: caret.bottom + 6 })
      }
      return
    }
    this.set({
      open: true,
      left: caret.left,
      top: caret.bottom + 6,
      query: suggestion.query,
      active: 0,
      error: null,
      loading: suggestion.query.trim() !== ''
    })
    this.scheduleSearch(suggestion.query)
  }

  handleKey = (event: KeyboardEvent): boolean => {
    if (!this.snapshot.open || event.isComposing) return false
    const rows = this.rows()
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (rows.length === 0) return false
        const step = event.key === 'ArrowDown' ? 1 : -1
        this.set({ active: (this.snapshot.active + step + rows.length) % rows.length })
        return true
      }
      case 'Enter':
      case 'Tab': {
        if (rows.length === 0 || event.shiftKey || event.metaKey || event.ctrlKey) return false
        void this.choose(this.snapshot.active)
        return true
      }
      case 'Escape': {
        this.dismissedFrom = this.suggestion?.from ?? null
        this.close()
        return true
      }
      default:
        return false
    }
  }

  detach = (): void => {
    this.close()
    this.suggestion = null
    this.target = null
  }

  // --- the picker itself -------------------------------------------------------------------------

  private close(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.searchToken++
    if (this.snapshot.open) this.set({ ...CLOSED })
  }

  /** Close without remembering anything (the editor lost focus). */
  dismiss = (): void => this.close()

  setActive = (index: number): void => {
    if (index !== this.snapshot.active) this.set({ active: index })
  }

  private scheduleSearch(query: string): void {
    if (this.timer) clearTimeout(this.timer)
    const token = ++this.searchToken
    if (query.trim() === '') {
      this.set({ groups: [], loading: false })
      return
    }
    this.timer = setTimeout(() => {
      void Promise.all(
        entityProviders().map(async (provider): Promise<PickerGroup> => {
          try {
            return { provider, hits: await provider.search(query, PER_KIND, this.self) }
          } catch (error) {
            console.error(`Searching ${provider.heading} for a mention failed:`, error)
            return { provider, hits: [] }
          }
        })
      ).then((groups) => {
        if (token !== this.searchToken) return
        this.set({ groups: groups.filter((g) => g.hits.length > 0), loading: false, active: 0 })
      })
    }, DEBOUNCE_MS)
  }

  /** Writes the chosen entity into the note in place of the `@…`, as a link to it followed by a space. */
  choose = async (index: number): Promise<void> => {
    const row = this.rows()[index]
    const target = this.target
    if (!row || !target) return
    let ref: EntityRef
    try {
      ref = await row.hit.prepare()
    } catch (error) {
      this.set({ error: error instanceof Error ? error.message : String(error) })
      return
    }
    // The note may have moved on while a uid was being written: only replace an `@…` that is still there.
    const current = target.current()
    if (!current) return
    target.insert(current, row.hit.label, ref)
  }
}
