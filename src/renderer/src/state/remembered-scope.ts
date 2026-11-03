import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useSettings } from './settings-context'

/**
 * A workspace's filter choice (Work's contract, Research's academic year): `all`, or the first day of one. Remembered in the
 * settings' module state under `key`, and held in one place for the whole app: the top bar's selector and the page under it must
 * agree, which a copy per caller would not.
 */
export interface ScopeStore {
  key: string
  subscribe: (listener: () => void) => () => void
  get: () => string | null
  set: (scope: string | null) => void
}

export function createScopeStore(key: string): ScopeStore {
  let held: string | null = null
  const listeners = new Set<() => void>()
  return {
    key,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get: () => held,
    set: (scope) => {
      held = scope
      listeners.forEach((l) => l())
    }
  }
}

/** The remembered value as stored: `{ scope }`; anything else is `fallback`. */
export function rememberedScope(raw: unknown, fallback: string): string {
  const scope = (raw as { scope?: unknown } | undefined)?.scope
  return typeof scope === 'string' && scope !== '' ? scope : fallback
}

/**
 * The remembered choice of a store, read from the settings the first time and held after; a choice is written at once.
 */
export function useRememberedScope(
  store: ScopeStore,
  fallback: string
): { scope: string; remember: (scope: string) => void } {
  const { settings, update } = useSettings()
  const held = useSyncExternalStore(store.subscribe, store.get)
  const latest = useRef({ settings, update })
  useEffect(() => {
    latest.current = { settings, update }
  })
  const remember = useCallback(
    (scope: string): void => {
      store.set(scope)
      const { settings: s, update: save } = latest.current
      void save({ ui: { moduleState: { ...s.ui.moduleState, [store.key]: { scope } } } })
    },
    [store]
  )
  return { scope: held ?? rememberedScope(settings.ui.moduleState[store.key], fallback), remember }
}
