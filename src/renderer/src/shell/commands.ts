import type { NavigateFunction } from 'react-router'
import { meetingRoute, peopleRoute } from '@modules/meetings/renderer/meetings-paths'
import { SERIES } from '@modules/meetings/shared/types'
import { noteRoute } from '@modules/notes/renderer/notes-paths'
import { entryRoute } from '@modules/training/renderer/training-paths'
import { searchTerms, type SearchHit } from '@shared/search'
import { todayIso } from '@shared/time'
import { fold } from '@shared/text'

const DEFAULT_LIMIT = 6

interface Command {
  id: string
  title: string
  detail: string
  go: (navigate: NavigateFunction) => void | Promise<void>
}

/** Actions the search window offers alongside results, the way a command palette does. Each does what its own
 * button does elsewhere in the app; nothing here is a shortcut around a rule those buttons enforce. */
const COMMANDS: Command[] = [
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
      navigate(meetingRoute(file.ref.id))
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
  },
  {
    id: 'open-settings',
    title: 'Open Settings',
    detail: '',
    go: (navigate) => navigate('/settings')
  },
  { id: 'open-people', title: 'Open People', detail: '', go: (navigate) => navigate(peopleRoute) },
  {
    id: 'show-data',
    title: 'Show your data folder',
    detail: 'Opens it in Finder.',
    go: () => window.api.app.revealData()
  }
]

export async function searchCommands(
  query: string,
  navigate: NavigateFunction,
  limit = DEFAULT_LIMIT
): Promise<SearchHit[]> {
  const terms = searchTerms(query)
  return COMMANDS.filter((c) => terms.every((t) => fold(c.title).includes(t)))
    .slice(0, limit)
    .map((c) => ({ key: c.id, title: c.title, detail: c.detail, run: () => c.go(navigate) }))
}
