/**
 * The kind a source used to have. Sources have no kind any more (29 Oct 2026: every item is sorted by its own words, `sectionOf`);
 * the column stays, holding this placeholder, because the CHECK in `watch/0001_init` lists the old kinds and a shipped migration is
 * never edited. It is never read.
 */
export const STORED_SOURCE_KIND = 'conference'

/** The workspaces that have a Watch: each has its own sources, and its items are its sources'. */
export const WATCH_WORKSPACES = ['research', 'life'] as const
export type WatchWorkspace = (typeof WATCH_WORKSPACES)[number]

/**
 * The sections of the Watch page. A summer school is a training; a fellowship, grant or special-issue call is an opportunity;
 * a meeting of researchers is a conference; any other occasion (a talk, a seminar, a launch) is an event.
 */
export const WATCH_SECTIONS = ['training', 'conference', 'event', 'opportunity'] as const
export type WatchSection = (typeof WATCH_SECTIONS)[number]

/** Words that make an item an opportunity, in its title. */
const OPPORTUNITY_TITLE =
  /\b(fellowships?|grants?|funding|funded|stipends?|scholarships?|bursar(?:y|ies)|awards?|call for applications|special issues?|thematic dossier)\b|\(jrnl\)/i
/** The narrower set that counts in the description (a conference's text mentions travel grants and awards in passing). */
const OPPORTUNITY_SUMMARY = /\b(fellowships?|stipends?|scholarships?|call for applications)\b/i
/** A word that says the item is an event, so that "apply by" alone does not make it an opportunity. */
const EVENT_WORDS =
  /\b(conferences?|confs?|symposi(?:um|a)|congress|colloqui(?:um|a)|meeting|workshops?|schools?|webinars?|courses?|training|masterclass|cpd|briefing|summit|seminar)\b/i
/** Words that make an item a course. */
const COURSE_WORDS =
  /\b(cpd|masterclass|webinars?|courses?|training|workshops?|briefing|summer schools?|introduction to|getting started|drop-in|surgery|clinic|tutorial|bootcamp|learn)\b/i
/** LINGUIST List's feeds tag their titles: "Calls:" are calls to journals (some carry no other word), "Confs:" are conferences. */
const CALLS_PREFIX = /^calls?:/i
const CONFS_PREFIX = /^confs?:/i
/** A source named for courses ("WRDTP: Training and events calendar", "Doctoral School: PGR events"): what it lists is training unless an item says otherwise. */
const TRAINING_SOURCE =
  /\b(training|courses?|schools?|workshops?|cpd|doctoral|pgr|learning|idre)\b/i
/** Words in a title that make an item a conference; without one (or a call for papers) it is an event. */
const CONFERENCE_WORDS = /\b(conferences?|symposi(?:um|a)|congress|colloqui(?:um|a)|meeting)\b/i
const PAPERS_CALL = /\b(call for (?:papers|abstracts|proposals|submissions)|cfp)\b/i

/**
 * The section of one item, from its own words (a source has no kind). Tests in this order:
 * 1. Opportunity: an opportunity word in the title (or a "Calls:" title), or a narrower set in the description, or "apply by" with no event word.
 * 2. Training: a course word. The one conflict, decided on the facts: a "workshop" that is a call for papers
 *    ("Workshop at SLE 2027 … call for papers") is a conference that happens to be called a workshop, not a course.
 * 3. What a training source (named for courses) lists is training: nothing there is a conference
 *    ("Preparing a Conference Submission" is a course).
 * 4. Conference: a conference word in the title, a "Confs:" title, or a call for papers.
 * 5. Everything else, when the words do not say, is an event.
 * A manual entry's section is chosen by the user and never goes through here.
 */
export function sectionOf(title: string, summary = '', sourceTitle = ''): WatchSection {
  const text = `${title}\n${summary}`
  // "Funded training" is a funded course, not funding.
  const opportunity = OPPORTUNITY_TITLE.exec(title)
  const fundedCourse = opportunity?.[1]?.toLowerCase() === 'funded' && COURSE_WORDS.test(title)
  if ((opportunity && !fundedCourse) || CALLS_PREFIX.test(title)) return 'opportunity'
  if (OPPORTUNITY_SUMMARY.test(summary) && !EVENT_WORDS.test(title)) return 'opportunity'
  if (/\bapply by\b/i.test(text) && !EVENT_WORDS.test(text)) return 'opportunity'
  // In a conference listing's own title ("Confs: Munich Inner Speech Workshop") a workshop is a meeting of researchers, not a course.
  const courseTitle = CONFS_PREFIX.test(title) ? title.replace(/\bworkshops?\b/gi, '') : title
  if (COURSE_WORDS.test(courseTitle) && !PAPERS_CALL.test(text)) return 'training'
  if (TRAINING_SOURCE.test(sourceTitle) && !CONFS_PREFIX.test(title)) return 'training'
  if (CONFS_PREFIX.test(title) || CONFERENCE_WORDS.test(title) || PAPERS_CALL.test(text))
    return 'conference'
  return 'event'
}

/**
 * How a source is read: a feed (RSS or Atom), a web page (its events, from the calendar it carries when it carries one, else from its
 * links and text), a page that is one event (its dates and its key-dates pages), or Crossref's list of a journal's newest articles.
 */
export const WATCH_METHODS = ['feed', 'page', 'event', 'crossref'] as const
export type WatchMethod = (typeof WATCH_METHODS)[number]

/** Stored states; the page calls `seen` "Read". There is no dismissed state: Save or Read are the two ways to deal with an item. */
export const WATCH_STATES = ['new', 'seen', 'saved'] as const
export type WatchState = (typeof WATCH_STATES)[number]

export interface WatchSource {
  id: number
  workspace: WatchWorkspace
  title: string
  url: string
  method: WatchMethod
  issn: string | null
  groupLabel: string
  taskUid: string | null
  intervalHours: number
  active: boolean
  lastCheckedAt: string | null
  lastOkAt: string | null
  lastError: string | null
  failures: number
  /** The page's text changed without a new link to show for it (page method). */
  changedAt: string | null
  createdAt: string
  /** Items not yet looked at. */
  newCount: number
}

export interface NewWatchSource {
  /** Absent reads as Research. */
  workspace?: WatchWorkspace
  title: string
  url: string
  method: WatchMethod
  issn?: string | null
  groupLabel?: string
  taskUid?: string | null
  intervalHours?: number
}

export type WatchSourceChanges = Partial<
  Pick<
    WatchSource,
    'title' | 'url' | 'groupLabel' | 'intervalHours' | 'active' | 'workspace' | 'method'
  >
>

export type DateKind = 'deadline' | 'date'

export interface WatchItem {
  id: number
  sourceId: number
  /** Its source's workspace. */
  workspace: WatchWorkspace
  sourceTitle: string
  /** Which section it is in: its own words (`sectionOf`), or the user's choice for an entry by hand. */
  section: WatchSection
  /** An entry the user added by hand: never checked, never removed by a check. */
  manual: boolean
  title: string
  url: string
  summary: string
  publishedAt: string | null
  /** The event's first and last day (YYYY-MM-DD); the end only for a range. */
  eventDate: string | null
  eventEnd: string | null
  /** A deadline for it (applying, submitting, registering) and the words for it: "Apply by". */
  deadline: string | null
  deadlineLabel: string | null
  /** The one date Home's Coming up and the notifications use: the deadline, else the event's day. */
  date: string | null
  dateKind: DateKind | null
  score: number
  matched: string[]
  state: WatchState
  firstSeenAt: string
}

export interface WatchItemsQuery {
  /** Only this workspace's sources' items. */
  workspace?: WatchWorkspace
  /** `open` is new or saved. */
  state?: WatchState | 'open'
  sourceId?: number
  section?: WatchSection
  /** Only items that mention at least one of the user's keywords. */
  relevantOnly?: boolean
  limit?: number
}

export interface WatchCounts {
  /** Items not yet looked at. */
  new: number
  /** Of those, the ones that mention a keyword. */
  newRelevant: number
  sources: number
  /** Sources whose last attempt failed. */
  failing: number
  /** Page sources whose text changed with nothing new to show. */
  changed: number
}

/** How a pasted address is probably read: a feed when it looks like one, a page otherwise. */
export function guessMethod(url: string): WatchMethod {
  return /\.(xml|rss|atom)(\?|$)|\/(rss|feed|atom)(\/|\?|$)|[?&]format=(rss|atom)/i.test(url)
    ? 'feed'
    : 'page'
}

/** What a source gave, before anything is stored. */
export interface ParsedItem {
  key: string
  title: string
  url: string
  summary: string
  publishedAt: string | null
  /** A link to another site (page method): kept only when it carries a coming date of its own. */
  offsite?: boolean
  /** Dates a structured source (an events API, iCal, JSON-LD) gives outright, so no text is read for them. */
  dates?: ItemDates
}

/** An item's dates as stored. */
export interface ItemDates {
  eventStart: string | null
  eventEnd: string | null
  deadline: string | null
  deadlineLabel: string | null
}

export interface CheckOutcome {
  sourceId: number
  status: 'ok' | 'unchanged' | 'error'
  /** Items stored for the first time. */
  added: number
  /** The first good check only sets what is already there as the baseline; nothing is "new" then, except recent feed items. */
  baseline: boolean
  error?: string
}

export interface WatchSuggestion {
  title: string
  url: string
  method: WatchMethod
  issn?: string
  groupLabel: string
}

/** An entry added by hand (any section); every field but the title is optional. */
export interface ManualItemInput {
  workspace?: WatchWorkspace
  title: string
  section: WatchSection
  url?: string
  summary?: string
  eventDate?: string | null
  eventEnd?: string | null
  deadline?: string | null
  deadlineLabel?: string | null
}

/** What a pasted link gave: the fields to fill in (all may be empty when the page could not be read). */
export interface EntryLinkRead {
  url: string
  title: string
  summary: string
  section: WatchSection
  eventDate: string | null
  eventEnd: string | null
  deadline: string | null
  deadlineLabel: string | null
  /** One line when the page could not be read; the link is kept anyway. */
  notice: string | null
}

/** The name of the hidden source that holds a workspace's entries by hand. */
export const MANUAL_SOURCE_TITLE = 'Added by hand'
