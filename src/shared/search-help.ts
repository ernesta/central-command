import { MODIFIER_NAMES, modifierValues, quoteValue, type ModifierName } from './search-query'

/** What one search modifier is described as, in the help row, the completion list and Settings: written once, here. */
interface ModifierHelp {
  /** A few words beside its name in the completion list. */
  hint: string
  /** What it filters, for the Settings page. */
  filters: string
  /** For a value that is not a fixed list: one muted line of the forms it accepts. */
  forms?: string
  /** Offer a few people as chips (`with:`, `by:`). */
  people?: boolean
}

const DAY_FORMS = 'YYYY-MM-DD, YYYY-MM, YYYY, today, yesterday'

export const MODIFIER_HELP: Record<ModifierName, ModifierHelp> = {
  in: { hint: 'one kind of item', filters: 'Only this kind of item' },
  workspace: { hint: 'one workspace', filters: 'Only this workspace’s items' },
  with: {
    hint: 'a person',
    filters: 'Meetings, training, readings and notes with this person',
    forms: 'A name or initials from the people list',
    people: true
  },
  by: {
    hint: 'author or lead',
    filters: 'Readings by an author, training by a lead',
    forms: 'A name or initials from the people list',
    people: true
  },
  status: { hint: 'task or reading', filters: 'A task’s status, or whether a reading is read' },
  priority: { hint: 'tasks', filters: 'A task’s priority' },
  due: { hint: 'tasks', filters: 'Tasks by due date' },
  list: { hint: 'tasks', filters: 'Tasks in a list', forms: 'A list or list/sublist' },
  tag: { hint: 'tasks, readings', filters: 'Tasks and readings with a tag', forms: 'A tag' },
  skill: {
    hint: 'training, meetings',
    filters: 'Training and meetings with a skill',
    forms: 'A skill from the skills list'
  },
  series: {
    hint: 'meetings, training',
    filters: 'Meetings and training in a series',
    forms: 'The name of a series'
  },
  has: { hint: 'it has this', filters: 'Items that have a due date, notes, to-dos or a summary' },
  before: { hint: 'a date', filters: 'Dated before this day', forms: DAY_FORMS },
  after: { hint: 'a date', filters: 'Dated after this day', forms: DAY_FORMS },
  on: { hint: 'a date', filters: 'Dated on this day', forms: DAY_FORMS },
  during: {
    hint: 'a period',
    filters: 'Dated within this period',
    forms: 'YYYY-MM, YYYY, today, yesterday, this/last week, month, year'
  },
  new: {
    hint: 'create one',
    filters:
      'Enter makes a new note, task, meeting, training or reading list; words, list:, due:, priority: and tag: fill it in'
  }
}

/** One value that can be clicked to fill in the modifier. */
export interface HelpChip {
  label: string
  /** What goes after the colon (quoted when it has spaces). */
  insert: string
}

/** What the help row and the Settings page show for a modifier. */
export interface ModifierSummary {
  name: ModifierName
  filters: string
  /** The accepted values as chips, for a modifier with a fixed set; empty otherwise. */
  chips: HelpChip[]
  /** The accepted forms as one muted line, for a free-form value; null when there are chips. */
  line: string | null
  /** Whether a few people are offered as chips as well. */
  people: boolean
}

export function summarise(name: ModifierName): ModifierSummary {
  const help = MODIFIER_HELP[name]
  const chips = modifierValues(name).map((v) => ({ label: v, insert: quoteValue(v) }))
  return {
    name,
    filters: help.filters,
    chips,
    line: chips.length > 0 ? null : (help.forms ?? null),
    people: help.people === true
  }
}

/** Every modifier in the order the tokenizer lists them: the Settings page reads this. */
export function allSummaries(): ModifierSummary[] {
  return MODIFIER_NAMES.map(summarise)
}
