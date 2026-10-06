/**
 * Backfilling the task descriptions the ClickUp CSV export dropped.
 *
 * The export's `Task Content` column carries ClickUp's plain-text rendering of a description, which is empty whenever
 * the description holds nothing but rich content (a link embed, a bookmark). The API keeps the real thing in
 * `markdown_description`, so the descriptions are fetched from there and tidied into the Markdown the editor writes.
 *
 * Pure: no network, no database. The script does the fetching and the writing.
 */

/** A description as ClickUp's API gives it, keyed by the task id we hold in `source_id`. */
export type FetchedDescriptions = Map<string, string>

/** What we hold for a task now. */
export interface StoredTask {
  uid: string
  sourceId: string
  title: string
  description: string
}

export interface BackfillChange {
  uid: string
  sourceId: string
  title: string
  /** The tidied Markdown to write. */
  description: string
  /** `link` when the whole description is one bare URL, `text` when it holds prose too. */
  kind: 'link' | 'text'
}

export interface BackfillPlan {
  changes: BackfillChange[]
  /** Tasks whose description we already hold; never touched, whatever ClickUp says. */
  kept: number
  /** Tasks empty here and empty in ClickUp too: nothing to do. */
  empty: number
  /** Tasks we hold whose id ClickUp did not return (deleted there, or out of reach). */
  missing: string[]
}

const host = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

/** Markdown's backslash escapes, so a label holding an escaped URL compares equal to the URL itself. */
const unescaped = (text: string): string => text.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1')

/** A line that is only `* * *`, `---` or `___`: a thematic break, which carries nothing as a description. */
const isThematicBreak = (line: string): boolean => /^\s*([*\-_]\s*){3,}$/.test(line)

/**
 * Whether a link's label says nothing the URL does not. ClickUp renders an embedded link with its domain and the URL
 * itself as the label, so the label is noise; a label with real words is kept.
 */
function labelIsJustTheUrl(label: string, url: string): boolean {
  const collapsed = unescaped(label).replace(/\s+/g, ' ').trim()
  if (collapsed === '') return true
  const bare = (s: string): string => s.replace(/[.,;:]+$/, '').replace(/\/+$/, '')
  const target = bare(url)
  const domain = host(url)
  const leftover = collapsed.split(' ').filter((piece) => {
    const p = bare(piece)
    if (p === target || p === domain || p === `www.${domain}`) return false
    // ClickUp sometimes truncates the URL in the label with an ellipsis.
    const stem = p.replace(/(\.{3}|\u2026)$/, '')
    return !(stem !== p && stem.length > 0 && target.startsWith(stem))
  })
  return leftover.length === 0
}

const LINK = /(?<!!)\[([^\][]*)\]\(([^()\s]+)\)/g

/**
 * Every link whose label only repeats its URL becomes the bare URL (the editor draws a plain URL as a link). Two
 * embeds that sit side by side in ClickUp would otherwise run their URLs together, so a bare URL always gets a line
 * of its own. A label that says something is kept, with its own escaping, collapsed onto one line.
 */
function bareTheLinks(text: string): string {
  let out = ''
  let last = 0
  let afterUrl = false
  for (const match of text.matchAll(LINK)) {
    const at = match.index as number
    const between = text.slice(last, at)
    if (afterUrl && between !== '' && !/^\s/.test(between)) out += '\n'
    out += between
    const [whole, label, url] = match
    const isBare = labelIsJustTheUrl(label, url)
    if (isBare && out !== '' && !/\s$/.test(out)) out += '\n'
    out += isBare ? url : `[${label.replace(/\s+/g, ' ').trim()}](${url})`
    afterUrl = isBare
    last = at + whole.length
  }
  const tail = text.slice(last)
  if (afterUrl && tail !== '' && !/^\s/.test(tail)) out += '\n'
  return out + tail
}

/**
 * ClickUp's `markdown_description` into the Markdown we store: embedded links become bare URLs, its `*` bullets
 * become the `-` the editor writes, runs of blank lines collapse, and the whole thing is trimmed. A description that
 * holds no letters or digits at all (a lone thematic break) counts as nothing. Image syntax is left alone.
 */
export function tidyClickupMarkdown(raw: string): string {
  const tidied = bareTheLinks(raw.replace(/\r\n?/g, '\n'))
    .split('\n')
    .map((line) => (isThematicBreak(line) ? line : line.replace(/^(\s*)\*[ \t]+(?=\S)/, '$1- ')))
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return /[A-Za-z0-9]/.test(tidied) ? tidied : ''
}

/** True when the description is one bare URL and nothing else. */
const isOneLink = (text: string): boolean => /^https?:\/\/\S+$/.test(text)

/**
 * What to write and what to leave. A description we already hold is never overwritten, so the 89 the CSV did carry
 * (and anything typed since) stay as they are.
 */
export function planDescriptionBackfill(
  tasks: StoredTask[],
  fetched: FetchedDescriptions
): BackfillPlan {
  const plan: BackfillPlan = { changes: [], kept: 0, empty: 0, missing: [] }
  for (const task of tasks) {
    if (task.description.trim() !== '') {
      plan.kept += 1
      continue
    }
    const raw = fetched.get(task.sourceId)
    if (raw === undefined) {
      plan.missing.push(task.sourceId)
      continue
    }
    const description = tidyClickupMarkdown(raw)
    if (description === '') {
      plan.empty += 1
      continue
    }
    plan.changes.push({
      uid: task.uid,
      sourceId: task.sourceId,
      title: task.title,
      description,
      kind: isOneLink(description) ? 'link' : 'text'
    })
  }
  return plan
}
