import type { NavigateFunction } from 'react-router'
import { meetingRoute } from '@modules/meetings/renderer/meetings-paths'
import { SERIES } from '@modules/meetings/shared/types'
import { noteRoute } from '@modules/notes/renderer/notes-paths'
import { entryRoute } from '@modules/training/renderer/training-paths'
import type { DockActionId } from '@shared/api'
import { todayIso } from '@shared/time'

/** The same three ids the Dock menu can send (`DockActionId`): one list of "start something now" actions. */
export type QuickActionId = DockActionId

export interface QuickAction {
  id: QuickActionId
  title: string
  detail: string
  go: (navigate: NavigateFunction) => void | Promise<void>
}

/**
 * The three "start something now" actions: what the command palette offers under those names, what the Dock
 * menu's quick actions run (macOS), and what each module's own "New …" button already does. One place, so
 * there is only ever one way a meeting, a training entry or a note gets created.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'new-note',
    title: 'New note',
    detail: 'Starts now, in the group you are looking at.',
    go: async (navigate) => {
      const file = await window.api.notes.create({ workspace: 'research' })
      navigate(noteRoute(file.ref.id), { state: { focus: 'body' } })
    }
  },
  {
    id: 'new-meeting',
    title: 'New meeting',
    detail: 'Starts today, filled in at leisure.',
    go: async (navigate) => {
      const file = await window.api.meetings.create({
        workspace: 'research',
        series: SERIES[0],
        date: todayIso()
      })
      navigate(meetingRoute('research', file.ref.id))
    }
  },
  {
    id: 'new-training',
    title: 'New training entry',
    detail: 'Starts today, filled in at leisure.',
    go: async (navigate) => {
      const file = await window.api.training.create({
        workspace: 'research',
        title: 'Untitled',
        date: todayIso()
      })
      navigate(entryRoute(file.ref.id), { state: { isNew: true } })
    }
  }
]

export function runQuickAction(
  id: QuickActionId,
  navigate: NavigateFunction
): void | Promise<void> {
  return QUICK_ACTIONS.find((a) => a.id === id)?.go(navigate)
}
