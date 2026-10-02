import { modulePath } from '@modules/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'

export function timeOffBase(workspace: HoursWorkspace): string {
  return modulePath({ workspace, id: 'time-off' })
}
