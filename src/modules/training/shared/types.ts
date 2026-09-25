/** Workspaces that can hold training entries. Research now. */
export const TRAINING_WORKSPACES = ['research'] as const
export type TrainingWorkspace = (typeof TRAINING_WORKSPACES)[number]

export interface TrainingType {
  /** The name shown in the app. */
  name: string
  /** The Inkpath activity type it stands for, so an entry can be entered there by hand. */
  inkpath: string
  group: 'Courses' | 'Conferences' | 'Work' | 'Contributions' | 'Other'
  /** What the type means, shown in the chooser. */
  description: string
}

/**
 * The activity types offered for an entry: one per Inkpath type (Supervisor meeting belongs to Meetings
 * and is not offered here). What Inkpath has no type for (seminars, inductions, lab meetings,
 * self-guided learning) is mapped by hand by the user; the app adds no types of its own.
 */
export const TRAINING_TYPES: readonly TrainingType[] = [
  {
    name: 'Research methods course',
    inkpath: 'Research-related courses',
    group: 'Courses',
    description: 'Methods, statistics, research design, data and software'
  },
  {
    name: 'Academic skills course',
    inkpath: 'Academic skills courses',
    group: 'Courses',
    description: 'Writing, presenting, publishing, CV'
  },
  {
    name: 'General skills course',
    inkpath: 'Generic skills courses',
    group: 'Courses',
    description: 'Skills useful beyond research: wellbeing, leadership, careers'
  },
  {
    name: 'Language course',
    inkpath: 'Language courses',
    group: 'Courses',
    description: 'Learning a language'
  },
  {
    name: 'Conference: attending',
    inkpath: 'Conference Guest',
    group: 'Conferences',
    description: 'You went as a visitor'
  },
  {
    name: 'Conference: presenting',
    inkpath: 'Conference Speaker / Contributor',
    group: 'Conferences',
    description: 'A talk, poster or paper'
  },
  {
    name: 'Conference: organising',
    inkpath: 'Conference Organisation Team',
    group: 'Conferences',
    description: 'You helped run it'
  },
  {
    name: 'Fieldwork',
    inkpath: 'Fieldwork',
    group: 'Work',
    description: 'Collecting data in the field'
  },
  {
    name: 'Placement',
    inkpath: 'Work placements or work-related projects',
    group: 'Work',
    description: 'A placement or a project done as work'
  },
  {
    name: 'Shadowing',
    inkpath: 'Shadowing',
    group: 'Work',
    description: 'Following someone at work'
  },
  { name: 'Volunteering', inkpath: 'Volunteering', group: 'Work', description: '' },
  {
    name: 'Peer review',
    inkpath: 'Peer reviews',
    group: 'Contributions',
    description: "Reviewing someone's paper"
  },
  {
    name: 'Publication',
    inkpath: 'Publications',
    group: 'Contributions',
    description: 'Submitting or publishing a paper or chapter'
  },
  { name: 'Other', inkpath: 'Other', group: 'Other', description: '' }
]

export const TRAINING_TYPE_NAMES: readonly string[] = TRAINING_TYPES.map((t) => t.name)

/** How an entry was attended. Meetings has the first two; self-paced is for things like DataCamp. */
export const TRAINING_MODES = ['in-person', 'online', 'self-paced'] as const
export type TrainingMode = (typeof TRAINING_MODES)[number]

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
  'in-person': 'In person',
  online: 'Online',
  'self-paced': 'Self-paced'
}

/** Series to start with; the user adds more by typing a new name. */
export const TRAINING_SERIES = ['SEDarc', 'DataCamp'] as const

/**
 * An entry's front matter, as far as the app understands it. Reading is lenient (a hand-edited file
 * never crashes the app); `problems` on the parse result says what was off.
 */
export interface TrainingMeta {
  /** YYYY-MM-DD, or '' when missing or malformed. */
  date: string
  /** 24-hour local time HH:MM, or null. */
  start: string | null
  end: string | null
  title: string
  /** Optional; any name (the list starts with SEDarc and DataCamp). */
  series: string | null
  /** Normally the name of one of TRAINING_TYPES; kept as written when it is not, and flagged. */
  type: string | null
  mode: TrainingMode | null
  /** Skills, as written (normally from the shared list); at most MAX_SKILLS. */
  skills: string[]
  /** People, as written. */
  leads: string[]
  /** The institution that provided it (the Inkpath Provider). */
  institution: string | null
  /** A folder of files, relative to the Trainings folder setting. */
  folder: string | null
  /** Kept from the Inkpath log; not shown yet. */
  organisation: string | null
  points: string | null
}

/** Which entry: the folder (workspace) and the file's base name, e.g. "2025-12-10 Data Management and Security". */
export interface TrainingRef {
  workspace: TrainingWorkspace
  id: string
}

/** What the database index holds about one entry file. */
export interface TrainingIndexRow {
  workspace: TrainingWorkspace
  id: string
  date: string
  start: string | null
  end: string | null
  title: string
  series: string | null
  type: string | null
  mode: TrainingMode | null
  skills: string[]
  leads: string[]
  institution: string | null
  folder: string | null
  /** Plain text of the Summary section; '' when empty. */
  summary: string
  /** Plain text of the whole note, for search. */
  excerpt: string
  /** Whether the Notes section holds any text. */
  hasNotes: boolean
  problems: string[]
  contentHash: string
}
