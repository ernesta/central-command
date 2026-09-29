import type { EntityRef } from '@shared/entities'
import { providerFor, type EntitySummary } from './registry'

export type Resolved =
  { state: 'pending' } | { state: 'found'; summary: EntitySummary } | { state: 'missing' }

const PENDING: Resolved = { state: 'pending' }

/**
 * What the mentions in one open note point at right now. Asked synchronously (the editor draws with whatever is
 * known), loads what is not known yet, and says when something arrived so the editor can draw again. One per editor,
 * so opening a note asks afresh: a reading deleted or a meeting renamed since is seen the next time the note is opened.
 */
export class EntityResolver {
  private readonly cache = new Map<string, Resolved>()
  private readonly listeners = new Set<() => void>()
  private notifying = false

  get(ref: EntityRef): Resolved {
    const id = `${ref.kind}\u0000${ref.key}`
    const known = this.cache.get(id)
    if (known) return known
    this.cache.set(id, PENDING)
    const provider = providerFor(ref.kind)
    if (!provider) {
      this.cache.set(id, { state: 'missing' })
      return PENDING
    }
    void provider
      .resolve(ref.key)
      .then(
        (summary): Resolved => (summary ? { state: 'found', summary } : { state: 'missing' }),
        (): Resolved => ({ state: 'missing' })
      )
      .then((resolved) => {
        this.cache.set(id, resolved)
        this.notify()
      })
    return PENDING
  }

  /** Called after something new is known. Several arrivals in one go make one call. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    if (this.notifying) return
    this.notifying = true
    queueMicrotask(() => {
      this.notifying = false
      for (const listener of this.listeners) listener()
    })
  }
}
