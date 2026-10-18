import type { Workspace } from '@shared/settings'

/** The workspaces that track hours. All are registered in `src/modules/index.ts`. */
export const HOURS_WORKSPACES = ['life', 'research', 'work'] as const satisfies readonly Workspace[]
export type HoursWorkspace = (typeof HOURS_WORKSPACES)[number]

/** The workspaces with Time off (a days-off allowance). Work only tracks time. */
export const TIME_OFF_WORKSPACES: readonly HoursWorkspace[] = ['research']

/** The workspaces with a plan to set in Settings (hours a week, days worked, contracts). Life tracks hours but has no plan. */
export const PLAN_WORKSPACES: readonly HoursWorkspace[] = ['research', 'work']
