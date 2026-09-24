import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '@renderer/state/settings-context'
import { normaliseViewPrefs, type ReadingsViewPrefs } from '../shared/query'

const MODULE_ID = 'readings'
const PERSIST_DELAY_MS = 400

/**
 * The Readings list state (search, filters, sort, view), remembered between visits and launches.
 * Changes apply instantly in the UI and are written to settings after a short pause, so typing
 * in the search box does not write a file on every keystroke.
 */
export function useReadingsView(): {
  prefs: ReadingsViewPrefs
  setPrefs: (patch: Partial<ReadingsViewPrefs>) => void
} {
  const { settings, update } = useSettings()
  const [prefs, setPrefsState] = useState(() =>
    normaliseViewPrefs(settings.ui.moduleState[MODULE_ID])
  )

  // Always persist against the latest settings, never a stale closure.
  const latest = useRef({ settings, update, prefs })
  useEffect(() => {
    latest.current = { settings, update, prefs }
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(() => {
    timer.current = null
    const { settings: s, update: save, prefs: p } = latest.current
    void save({ ui: { moduleState: { ...s.ui.moduleState, [MODULE_ID]: p } } })
  }, [])

  const setPrefs = useCallback(
    (patch: Partial<ReadingsViewPrefs>) => {
      setPrefsState((current) => {
        const next = { ...current, ...patch }
        latest.current.prefs = next
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

  return { prefs, setPrefs }
}
