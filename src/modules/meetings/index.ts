import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { MeetingPage } from './renderer/MeetingPage'
import { MeetingsCard } from './renderer/MeetingsCard'
import { MeetingsPage } from './renderer/MeetingsPage'

/** Meetings: notes for every meeting, with TODOs carried over from one meeting to the next. */
export const meetingsModule: LiveModuleManifest = {
  id: 'meetings',
  workspace: 'research',
  label: 'Meetings',
  status: 'live',
  routes: [
    { path: '', element: createElement(MeetingsPage) },
    { path: ':id', element: createElement(MeetingPage) }
  ],
  landingCard: MeetingsCard
}
