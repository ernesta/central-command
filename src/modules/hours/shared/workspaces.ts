import type { Workspace } from '@shared/settings'

/** The workspaces that track hours. Only Research is registered for now (`src/modules/index.ts`). */
export const HOURS_WORKSPACES = ['research', 'work'] as const satisfies readonly Workspace[]
export type HoursWorkspace = (typeof HOURS_WORKSPACES)[number]
