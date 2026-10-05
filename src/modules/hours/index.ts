import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { HoursCard } from './renderer/HoursCard'
import { HoursPage } from './renderer/HoursPage'
import { HoursYearPage } from './renderer/HoursYearPage'
import { HoursSettings } from './renderer/HoursSettings'
import { TimerChip } from './renderer/TimerChip'
import type { HoursWorkspace } from './shared/workspaces'

/**
 * Hours: the time tracked on tasks, a day and a week at a time, against the plan. Registered once per workspace
 * that tracks hours (`src/modules/index.ts`); each instance shows only its own workspace's year files.
 */
export function createHoursModule(workspace: HoursWorkspace): LiveModuleManifest {
  return {
    id: 'hours',
    workspace,
    label: 'Hours',
    status: 'live',
    routes: [
      { path: '', element: createElement(HoursPage) },
      { path: 'year', element: createElement(HoursYearPage) }
    ],
    landingCard: HoursCard,
    // One Hours tab for the whole app (tabs are keyed by module id): Research's instance draws it, with a block per workspace.
    settingsSection: workspace === 'research' ? HoursSettings : undefined,
    // One timer for the whole app: only one instance draws the chip, whichever workspace it is running in.
    globals: workspace === 'research' ? TimerChip : undefined
  }
}
