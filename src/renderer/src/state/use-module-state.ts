import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from './settings-context'

const PERSIST_DELAY_MS = 400

/**
 * A module's remembered UI state (a list's search, filters, sort), kept in `settings.ui.moduleState` so it
 * survives leaving the page and restarting the app. `normalise` turns whatever was stored (possibly
 * hand-edited or from an older version) into a valid value. Changes apply instantly and are written after a
 * short pause, so typing in a search box does not write a file on every keystroke; a pending change is
 * written when the page is left. `initial` overrides parts of the saved state for this visit only (for
 * example a link that opens a list already filtered); it is saved only if the user then changes something.
 */
export function useModuleState<T extends object>(
  moduleId: string,
  normalise: (raw: unknown) => T,
  initial?: Partial<T>
): { value: T; update: (patch: Partial<T>) => void } {
  const { settings, update: saveSettings } = useSettings()
  const [value, setValue] = useState<T>(() => ({
    ...normalise(settings.ui.moduleState[moduleId]),
    ...initial
  }))

  // Always persist against the latest settings, never a stale closure.
  const latest = useRef({ settings, saveSettings, value })
  useEffect(() => {
    latest.current = { settings, saveSettings, value }
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(() => {
    timer.current = null
    const { settings: s, saveSettings: save, value: v } = latest.current
    void save({ ui: { moduleState: { ...s.ui.moduleState, [moduleId]: v } } })
  }, [moduleId])

  const update = useCallback(
    (patch: Partial<T>) => {
      setValue((current) => {
        const next = { ...current, ...patch }
        latest.current.value = next
        return next
      })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(persist, PERSIST_DELAY_MS)
    },
    [persist]
  )

  // Save any pending change when leaving the page.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        persist()
      }
    },
    [persist]
  )

  return { value, update }
}
