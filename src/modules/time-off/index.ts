import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import type { HoursWorkspace } from '../hours/shared/workspaces'
import { TimeOffCard } from './renderer/TimeOffCard'
import { TimeOffPage } from './renderer/TimeOffPage'

/** Time off: the days off a year (holidays and annual leave), taken and booked. Registered per workspace that tracks hours. */
export function createTimeOffModule(workspace: HoursWorkspace): LiveModuleManifest {
  return {
    id: 'time-off',
    workspace,
    label: 'Time off',
    status: 'live',
    routes: [{ path: '', element: createElement(TimeOffPage) }],
    landingCard: TimeOffCard
  }
}
