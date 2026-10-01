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
    // A tab named after the module: when Work is registered its settings will need to say which workspace they are for.
    settingsSection: () => createElement(HoursSettings, { workspace }),
    // One timer for the whole app: only one instance draws the chip, whichever workspace it is running in.
    globals: workspace === 'research' ? TimerChip : undefined
  }
}
