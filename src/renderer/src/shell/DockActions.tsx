import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { runQuickAction } from './quick-actions'
import { useQuickActionWorkspace } from './useQuickActionWorkspace'

/** Runs a quick action chosen from the Dock menu (macOS; does nothing elsewhere, since none is ever sent). Renders nothing. */
export function DockActions(): null {
  const navigate = useNavigate()
  const workspace = useQuickActionWorkspace()
  useEffect(
    () => window.api.app.onDockAction((action) => void runQuickAction(action, navigate, workspace)),
    [navigate, workspace]
  )
  return null
}
