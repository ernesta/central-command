import type { LucideIcon } from 'lucide-react'
import { ENTITY_KINDS, type EntityKind, type EntityRef } from '@shared/entities'

/** One thing the picker offers: what to show, what to write into the note, and how to get its address. */
export interface EntityHit {
  /** Unique within its provider. */
  id: string
  /** The line that names it. */
  title: string
  /** One quieter line (who, when, where). */
  detail: string
  /** The text the mention is written with (a short citation, a name, a meeting's date). */
  label: string
  /**
   * The address to link to. Async because some kinds need something done first (a note or meeting gets its `uid`
   * written into its front matter the first time it is linked to).
   */
  prepare: () => Promise<EntityRef>
}

/** What a mention points at right now, for the hover card and for opening it. */
export interface EntitySummary {
  title: string
  detail: string
  /** Where opening it goes. */
  route: string
}

/** The note or meeting being edited, so it is never offered as a link to itself. */
export interface EntitySelf {
  kind: EntityKind
  workspace: string
  id: string
}

/**
 * What a kind of entity has to offer the editor. A module provides one (`entities` in its manifest); the editor knows
 * nothing about readings or meetings. A new kind (tasks) is a new provider plus its kind in `@shared/entities`.
 */
export interface EntityProvider {
  kind: EntityKind
  /** The picker's heading for this kind: "People". */
  heading: string
  /** One word for one of them: "person". Shown in the hover card. */
  noun: string
  icon: LucideIcon
  /** The best few matches for what was typed after `@`, most relevant first. */
  search: (query: string, limit: number, self: EntitySelf | null) => Promise<EntityHit[]>
  /** What the key names now, or null when it no longer exists. */
  resolve: (key: string) => Promise<EntitySummary | null>
}

let providers: readonly EntityProvider[] = []

/** Set once at start-up from the modules' manifests (`src/modules/index.ts`). */
export function registerEntityProviders(list: readonly EntityProvider[]): void {
  // The picker lists kinds in the order of `ENTITY_KINDS` (people first), whatever order the modules register in.
  providers = [...list].sort((a, b) => ENTITY_KINDS.indexOf(a.kind) - ENTITY_KINDS.indexOf(b.kind))
}

export function entityProviders(): readonly EntityProvider[] {
  return providers
}

export function providerFor(kind: EntityKind): EntityProvider | undefined {
  return providers.find((p) => p.kind === kind)
}
