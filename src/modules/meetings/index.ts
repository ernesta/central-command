import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { MeetingPage } from './renderer/MeetingPage'
import { MeetingsCard } from './renderer/MeetingsCard'
import { MeetingsLanding } from './renderer/MeetingsLanding'
import { MeetingsPage } from './renderer/MeetingsPage'
import { searchMeetings } from './renderer/search'
import { PeoplePage } from './renderer/PeoplePage'
import { PersonPage } from './renderer/PersonPage'
import { MEETINGS_SHORTCUTS } from './shared/shortcuts'
import type { MeetingWorkspace } from './shared/types'

/**
 * Meetings: notes for every meeting, with TODOs carried over from one meeting to the next. Registered
 * once per workspace that has meetings (`src/modules/index.ts`); each instance shows only its own
 * workspace's meetings. People are shared across every workspace, not per-workspace, so only the
 * 'research' instance carries the People routes — a Work meeting's attendee still links out to that one
 * shared page (`meetings-paths.ts`'s `peopleRoute`/`personRoute` always point at it).
 */
export function createMeetingsModule(workspace: MeetingWorkspace): LiveModuleManifest {
  return {
    id: 'meetings',
    workspace,
    label: 'Meetings',
    status: 'live',
    routes: [
      { path: '', element: createElement(MeetingsLanding) },
      { path: 'all', element: createElement(MeetingsPage) },
      { path: 'm/:id', element: createElement(MeetingPage) },
      ...(workspace === 'research'
        ? [
            { path: 'people', element: createElement(PeoplePage) },
            { path: 'people/:name', element: createElement(PersonPage) }
          ]
        : [])
    ],
    landingCard: MeetingsCard,
    search: searchMeetings(workspace),
    shortcuts: workspace === 'research' ? MEETINGS_SHORTCUTS : []
  }
}
