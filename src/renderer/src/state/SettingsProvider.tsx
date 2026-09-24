import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SettingsPatch } from '@shared/api'
import type { Settings } from '@shared/settings'
import { SettingsContext } from './settings-context'

/** Loads settings once from the main process and keeps a synchronised copy for the UI. */
export function SettingsProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element | null {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void window.api.settings.get().then(setSettings)
  }, [])

  const update = useCallback(async (patch: SettingsPatch) => {
    setSettings(await window.api.settings.update(patch))
  }, [])

  const value = useMemo(() => (settings ? { settings, update } : null), [settings, update])
  // Render nothing for the few milliseconds before settings arrive, so the UI never flashes defaults.
  if (!value) return null
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
