/** The tab remembered between visits (`settings.ui.moduleState.settings`). Falls back to the first tab that still exists. */
export interface SettingsTabState {
  tab: string
}

/** Turn whatever was stored (possibly hand-edited, or naming a module that no longer contributes a tab) into a valid tab id. */
export function normaliseSettingsTab(raw: unknown, validIds: readonly string[]): SettingsTabState {
  const tab = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).tab : undefined
  return { tab: typeof tab === 'string' && validIds.includes(tab) ? tab : validIds[0] }
}
