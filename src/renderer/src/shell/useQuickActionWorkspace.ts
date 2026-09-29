import { useLocation } from 'react-router'
import { useSettings } from '../state/settings-context'
import { quickActionWorkspace, type QuickActionWorkspace } from './quick-actions'

/** The workspace "New note" and "New meeting" start in from wherever the visitor is now. */
export function useQuickActionWorkspace(): QuickActionWorkspace {
  const { pathname } = useLocation()
  const { settings } = useSettings()
  return quickActionWorkspace(pathname, settings.ui.workspace)
}
