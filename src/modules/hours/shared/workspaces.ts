import type { Workspace } from '@shared/settings'

/** The workspaces that track hours. Both are registered in `src/modules/index.ts`. */
export const HOURS_WORKSPACES = ['research', 'work'] as const satisfies readonly Workspace[]
export type HoursWorkspace = (typeof HOURS_WORKSPACES)[number]

/** The workspaces with Time off (a days-off allowance). Work only tracks time. */
export const TIME_OFF_WORKSPACES: readonly HoursWorkspace[] = ['research']
