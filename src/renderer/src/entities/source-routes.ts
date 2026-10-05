import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  ListChecks,
  ListTodo,
  StickyNote
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { meetingRoute } from '@modules/meetings/renderer/meetings-paths'
import type { MeetingWorkspace } from '@modules/meetings/shared/types'
import { noteRoute } from '@modules/notes/renderer/notes-paths'
import type { NoteWorkspace } from '@modules/notes/shared/types'
import { readingListRoute } from '@modules/reading-lists/renderer/reading-lists-paths'
import { taskRoute } from '@modules/tasks/renderer/tasks-paths'
import type { TaskWorkspace } from '@modules/tasks/shared/types'
import { modulePath } from '@modules/types'
import { entryRoute, trainingPlanRoute } from '@modules/training/renderer/training-paths'
import type { BacklinkSource } from '@shared/entities'

/** Where a place that mentions something is opened, and the icon that says what kind of place it is. */
export function sourceTarget(source: BacklinkSource): { route: string; icon: LucideIcon } {
  switch (source.kind) {
    case 'note':
      return { route: noteRoute(source.workspace as NoteWorkspace, source.id), icon: StickyNote }
    case 'meeting':
      return {
        route: meetingRoute(source.workspace as MeetingWorkspace, source.id),
        icon: CalendarDays
      }
    case 'training':
      return { route: entryRoute(source.id), icon: GraduationCap }
    case 'reading-list':
      return { route: readingListRoute(source.id), icon: ListChecks }
    case 'reading-notes':
      return {
        route: `${modulePath({ workspace: 'research', id: 'readings' })}/${encodeURIComponent(source.id)}`,
        icon: BookOpen
      }
    case 'task':
      return { route: taskRoute(source.workspace as TaskWorkspace, source.id), icon: ListTodo }
    case 'plan': {
      const year = /(\d{4})-\d{2}$/.exec(source.id)?.[1]
      return {
        route: year ? `${trainingPlanRoute}?year=${year}` : trainingPlanRoute,
        icon: ClipboardList
      }
    }
  }
}
