import type { HomeSummary, HomeTasks, HomeWorkspace } from './types'

export const NO_TASKS: HomeTasks = { overdue: [], today: [], overdueTotal: 0, todayTotal: 0 }

/** A summary's task lists with these in the given workspaces and none in the others. */
export const tasksIn = (
  lists: Partial<Record<HomeWorkspace, Partial<HomeTasks>>>
): HomeSummary['tasks'] => ({
  research: { ...NO_TASKS, ...lists.research },
  work: { ...NO_TASKS, ...lists.work },
  life: { ...NO_TASKS, ...lists.life }
})
