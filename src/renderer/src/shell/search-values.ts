import type { CompletionOption, UserValues } from '@shared/search-complete'
import { quoteValue } from '@shared/search-query'
import { SKILLS } from '@shared/skills'
import { fold } from '@shared/text'
import { TASK_WORKSPACES } from '@modules/tasks/shared/types'

const option = (label: string, hint?: string): CompletionOption => ({
  label,
  insert: quoteValue(label),
  hint
})

/** Each value once (case and accents ignored), in the spelling first met, sorted. */
function distinct(values: Iterable<string>): string[] {
  const seen = new Map<string, string>()
  for (const v of values) if (v.trim() !== '' && !seen.has(fold(v))) seen.set(fold(v), v)
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch {
    return fallback
  }
}

/**
 * The values the completion list offers that come from the user's own data: people (names, with their initials), task lists and
 * sublists, tags (tasks and readings), the skills list, and the series of meetings and training. Read once when the search opens.
 */
export async function loadUserValues(): Promise<UserValues> {
  const api = window.api
  const [people, tasks, readingTags, meetings, training] = await Promise.all([
    safe(api.meetings.people.list(), []),
    safe(Promise.all(TASK_WORKSPACES.map((w) => api.tasks.list(w))), []),
    safe(api.readings.tags(), []),
    safe(Promise.all((['research', 'work'] as const).map((w) => api.meetings.list(w))), []),
    safe(Promise.all((['research', 'life'] as const).map((w) => api.training.list(w))), [])
  ])
  const allTasks = tasks.flat()
  const lists = allTasks
    .filter((t) => t.parentUid === null && t.list !== '')
    .flatMap((t) => (t.sublist ? [t.list, `${t.list}/${t.sublist}`] : [t.list]))
  const tags = [...allTasks.flatMap((t) => t.tags), ...readingTags.map((t) => t.tag)]
  const series = [
    ...meetings.flat().map((m) => m.series),
    ...training.flat().map((t) => t.series ?? '')
  ]
  const names = people.filter((p) => !p.archived).map((p) => option(p.name, p.initials))
  return {
    with: names,
    by: names,
    list: distinct(lists).map((l) => option(l)),
    tag: distinct(tags).map((t) => option(t)),
    skill: SKILLS.map((s) => option(s.name)),
    series: distinct(series).map((s) => option(s))
  }
}
