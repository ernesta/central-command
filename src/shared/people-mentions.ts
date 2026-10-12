import { entityHref, escapeLabel, findMentions } from './entities'
import { asList, parseHead, readValue } from './front-matter'
import { isProtected, protectedRanges } from './note-text'

/**
 * People named in prose to person entities (requested 11 Oct 2026): "Reach out to Matthew Jukes" becomes
 * "Reach out to [Matthew Jukes](cc://person/Matthew%20Jukes)", and "Weekly meetings with Kathy" becomes
 * "Weekly meetings with [Kathy](cc://person/Kathy%20Rastle)" — the label is the words in the prose (so un-chipping
 * gives the note back exactly), the address names the person. The editor draws the chip with the person's full name,
 * never the label (`chipText`).
 *
 * Front matter is never touched (`attendees:` and `lead:` are structured fields with their own UI), nor are headings,
 * code, URLs or text that is already a link.
 *
 * Three rules the user set on 11 Oct 2026, after seeing a first pass that chipped every mention:
 *
 * 1. **Never the user themselves** (the person flagged `me` in the people list). Their own notes are about their own
 *    work; a chip pointing at themselves says nothing.
 * 2. **Never someone who was in the meeting** (the note's `attendees`, or a training's `lead`/`leads`). "It's clear
 *    whom we are referring to" — the people present are already named in the note's own front matter.
 * 3. **Only the first mention of a person per note.** Later mentions read as ordinary prose.
 *
 * All three match what the user's hand-written notes were already doing, and together they are authoritative: the pass
 * both adds the chips the rules call for and takes away ones that break them, so running it twice changes nothing.
 */

/** A spelling to look for, and the person it names. Several aliases may point at one person. */
export interface PersonAlias {
  /** The text as it appears in a note: a full name, or a first name on its own. */
  text: string
  /** The person, spelled as the people list spells it — the entity's key. */
  name: string
  /**
   * True for a first name or other short form. A short form is checked harder: it is skipped where a surname or
   * initial follows it (a fuller name, which is someone else's or is the full-name pass's job) or where it reads as a
   * citation. A full name needs none of that, being unambiguous on its own.
   */
  short?: boolean
}

export interface PersonMentionInProse {
  /** The name as it stands in the text, which becomes the label. */
  start: number
  end: number
  text: string
  /** The person it names. */
  name: string
}

/** Why a short form that was found is not being linked. */
export interface SkippedMention {
  start: number
  text: string
  reason: string
}

/** Capitalised words that may follow a first name without making it part of a longer name. */
const HARMLESS_NEXT = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Mon',
  'Tue',
  'Tues',
  'Wed',
  'Thu',
  'Thur',
  'Thurs',
  'Fri',
  'Sat',
  'Sun',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
  'I',
  'TODO',
  'OK',
  'UK',
  'US'
])

/** A name used as a word: not inside a longer word, and not part of a longer name. */
const boundary = (text: string, start: number, end: number): boolean =>
  !/[\p{L}\p{N}'’-]/u.test(text[start - 1] ?? ' ') && !/[\p{L}\p{N}-]/u.test(text[end] ?? ' ')

/**
 * Why this short form should not be linked here, or ''. Two shapes are rejected: a capitalised word right after it,
 * which makes it part of a longer name ("Thomas Henry Huxley", "Dr James D Williams", "Ernesta Orlovaite"), and a year
 * in brackets, which makes it a citation's author ("Collier and Thomas (2017)") rather than the person.
 */
export function shortFormProblem(text: string, end: number): string {
  const tail = text.slice(end, end + 48)
  const next = /^[ \u00a0]+([\p{Lu}][\p{L}.'’-]*)/u.exec(tail)
  if (next) {
    const word = next[1].replace(/[.,;:]+$/, '')
    // An acronym in capitals ("PGR", "OOO") is not a surname; a single initial ("D") is part of a longer name.
    const acronym = word.length > 1 && word === word.toUpperCase() && /^[\p{Lu}]+$/u.test(word)
    if (!acronym && !HARMLESS_NEXT.has(word))
      return `followed by "${next[1]}", so part of a longer name`
  }
  if (/^[ \u00a0]*\((?:19|20)\d\d[a-z]?\)/.test(tail)) return 'reads as a citation, not the person'
  return ''
}

export interface ProseOptions {
  /** People never linked in this note: the user themselves, and anyone who was present. */
  skip?: ReadonlySet<string>
  /** The user's own name, so a skip can name which of the two rules it was (rule 1 rather than rule 2). */
  me?: string
  /** Link only the first mention of each person (rule 3). */
  firstMentionOnly?: boolean
}

/** Which rule keeps this person out of this note, for the report. */
const skipReason = (name: string, options: ProseOptions): string =>
  name === options.me ? 'is you' : 'was in the meeting'

export interface ProseScan {
  mentions: PersonMentionInProse[]
  skipped: SkippedMention[]
}

/**
 * The people a note says were present: `attendees` for a meeting, `lead`/`leads` for a training. Read from the head
 * with the shared front-matter reader, so the quoted, inline-list and `- item` spellings all work.
 */
export function peoplePresent(head: string): string[] {
  const parsed = parseHead(head)
  if (!parsed) return []
  const out: string[] = []
  for (const entry of parsed.entries) {
    if (entry.key !== 'attendees' && entry.key !== 'lead' && entry.key !== 'leads') continue
    for (const name of asList(readValue(entry))) {
      const trimmed = name.trim()
      if (trimmed) out.push(trimmed)
    }
  }
  return out
}

/**
 * Every alias found in prose, in order and without overlaps. Longer spellings are matched first, so a full name wins
 * over the first name inside it.
 */
export function scanPersonMentionsInProse(
  text: string,
  aliases: readonly PersonAlias[],
  options: ProseOptions = {}
): ProseScan {
  const skip = protectedRanges(text)
  const taken: Array<[number, number]> = []
  const mentions: PersonMentionInProse[] = []
  const skipped: SkippedMention[] = []
  for (const alias of [...aliases].sort((a, b) => b.text.length - a.text.length)) {
    let at = text.indexOf(alias.text)
    while (at >= 0) {
      const end = at + alias.text.length
      if (
        boundary(text, at, end) &&
        !isProtected(skip, at, end) &&
        !taken.some(([a, b]) => at < b && end > a)
      ) {
        const problem = options.skip?.has(alias.name)
          ? skipReason(alias.name, options)
          : alias.short
            ? shortFormProblem(text, end)
            : ''
        taken.push([at, end])
        if (problem) skipped.push({ start: at, text: alias.text, reason: problem })
        else mentions.push({ start: at, end, text: alias.text, name: alias.name })
      }
      at = text.indexOf(alias.text, at + 1)
    }
  }
  const inOrder = mentions.sort((a, b) => a.start - b.start)
  if (!options.firstMentionOnly)
    return { mentions: inOrder, skipped: skipped.sort((a, b) => a.start - b.start) }
  const seen = new Set<string>()
  const first: PersonMentionInProse[] = []
  for (const m of inOrder) {
    if (seen.has(m.name)) {
      skipped.push({
        start: m.start,
        text: m.text,
        reason: 'already mentioned earlier in this note'
      })
      continue
    }
    seen.add(m.name)
    first.push(m)
  }
  return { mentions: first, skipped: skipped.sort((a, b) => a.start - b.start) }
}

/** Just the mentions, for callers that do not report what was skipped. */
export function findPersonMentionsInProse(
  text: string,
  aliases: readonly PersonAlias[]
): PersonMentionInProse[] {
  return scanPersonMentionsInProse(text, aliases).mentions
}

/** Full names as aliases: every person, by their own name. */
export function fullNameAliases(names: readonly string[]): PersonAlias[] {
  return names.map((name) => ({ text: name, name }))
}

/**
 * First names as aliases, but only where one person in the list has that first name. A first name two people share
 * ("Caitlin", "Chris") cannot be resolved from the text and is left out for the user to map by hand.
 */
export function firstNameAliases(names: readonly string[]): {
  aliases: PersonAlias[]
  ambiguous: Map<string, string[]>
} {
  const byFirst = new Map<string, string[]>()
  for (const name of names) {
    const first = name.split(/\s+/)[0]
    if (!first || first === name) continue
    byFirst.set(first, [...(byFirst.get(first) ?? []), name])
  }
  const aliases: PersonAlias[] = []
  const ambiguous = new Map<string, string[]>()
  for (const [first, people] of byFirst) {
    if (people.length === 1) aliases.push({ text: first, name: people[0], short: true })
    else ambiguous.set(first, people)
  }
  return { aliases, ambiguous }
}

/** The text with every mention wrapped as `[text](cc://person/name)`. */
export function applyPersonMentionsInProse(
  text: string,
  mentions: readonly PersonMentionInProse[]
): string {
  let out = text
  for (const m of [...mentions].sort((a, b) => b.start - a.start)) {
    out =
      out.slice(0, m.start) +
      `[${escapeLabel(m.text)}](${entityHref({ kind: 'person', key: m.name })})` +
      out.slice(m.end)
  }
  return out
}

/**
 * The rewrite undone: every new link back to the plain name it came from. The caller checks this gives the original
 * text byte for byte, so a rewrite that touched anything else is left alone rather than written.
 */
export function undoPersonMentionsInProse(
  next: string,
  mentions: readonly PersonMentionInProse[]
): string {
  let out = next
  let at = 0
  for (const m of [...mentions].sort((a, b) => a.start - b.start)) {
    const link = `[${escapeLabel(m.text)}](${entityHref({ kind: 'person', key: m.name })})`
    const found = out.indexOf(link, at)
    if (found < 0) return next
    out = out.slice(0, found) + m.text + out.slice(found + link.length)
    at = found + m.text.length
  }
  return out
}

/** Every person chip in the text, in order. */
export function findPersonChips(
  text: string
): Array<{ start: number; end: number; label: string; name: string }> {
  return findMentions(text)
    .filter((m) => m.ref.kind === 'person')
    .map((m) => ({ start: m.start, end: m.end, label: m.label, name: m.ref.key }))
}

/** The text with every person chip's label written as the person's full name (the chip's address), and nothing else changed. */
export function fullNamePersonChips(text: string): { text: string; changed: number } {
  let out = text
  let changed = 0
  for (const chip of findPersonChips(text).reverse()) {
    const label = escapeLabel(chip.name)
    if (text.slice(chip.start, chip.end).startsWith(`[${label}](`)) continue
    const address = text.slice(chip.start, chip.end).slice(chip.label.length + 1)
    out = out.slice(0, chip.start) + `[${label}${address}` + out.slice(chip.end)
    changed++
  }
  return { text: out, changed }
}

/** The text with every person chip replaced by its own label, so `[Kathy](cc://person/…)` becomes `Kathy`. */
export function unchipPersonMentions(text: string): string {
  let out = text
  for (const chip of findPersonChips(text).reverse())
    out = out.slice(0, chip.start) + chip.label.replace(/\\([[\]\\])/g, '$1') + out.slice(chip.end)
  return out
}

export interface ChipPlan {
  /** The note as the rules say it should be. */
  next: string
  /** Chips the rules call for that were not there. */
  added: number
  /** Chips that were there and break a rule. */
  removed: Array<{ label: string; name: string; reason: string }>
  /** Chips that were already right and are written back unchanged. */
  kept: number
  skipped: SkippedMention[]
}

/**
 * What a note should look like under the rules, worked out from its text alone: every person chip is taken off, the
 * rules are applied to the plain prose, and the chips they call for are put back. Because the plan is built from the
 * un-chipped text, it both adds and removes, and running it on its own output changes nothing.
 *
 * `unchipPersonMentions(plan.next)` always equals `unchipPersonMentions(text)` — only chips move, never the prose. The
 * caller must check that before writing.
 */
export function planPersonChips(
  text: string,
  aliases: readonly PersonAlias[],
  options: ProseOptions = {}
): ChipPlan {
  const before = findPersonChips(text)
  const plain = unchipPersonMentions(text)
  const { mentions, skipped } = scanPersonMentionsInProse(plain, aliases, options)
  const next = applyPersonMentionsInProse(plain, mentions)
  // Match what was there against what the rules want, person by person, to say what was added and what was dropped.
  const wanted = new Map<string, number>()
  for (const m of mentions) wanted.set(m.name, (wanted.get(m.name) ?? 0) + 1)
  const removed: Array<{ label: string; name: string; reason: string }> = []
  let kept = 0
  for (const chip of before) {
    const left = wanted.get(chip.name) ?? 0
    if (left > 0) {
      wanted.set(chip.name, left - 1)
      kept++
      continue
    }
    const reason =
      options.skip?.has(chip.name) === true
        ? skipReason(chip.name, options)
        : before.filter((c) => c.name === chip.name).length > 1
          ? 'not the first mention in this note'
          : 'not a mention the rules link'
    removed.push({ label: chip.label, name: chip.name, reason })
  }
  const added = [...wanted.values()].reduce((n, v) => n + v, 0)
  return { next, added, removed, kept, skipped }
}

/**
 * An explicit alias the user has decided on, for a spelling the rules cannot resolve by themselves: a first name two
 * people share, or a short form of their own ("Caitlin B."). These live in the user's own library
 * (`data/people-aliases.json`), not in the repo, because they are their data and theirs to extend.
 */
export interface AliasEntry {
  /** The text as written in the notes. */
  text: string
  /** The person it names, spelled as the people list spells it. */
  person: string
  /** Workspaces it holds in ('research', 'work', 'life'); left out means everywhere. */
  workspaces?: string[]
  /** Particular notes, by path inside the notes folder; left out means every note. */
  notes?: string[]
}

/** The workspace a note's path names ('research', 'work', 'life'), or '' when its folder has none. */
export function workspaceOf(rel: string): string {
  const parts = rel.split('/')
  const second = parts.length > 1 ? parts[1] : ''
  return second === 'research' || second === 'work' || second === 'life' ? second : ''
}

/**
 * The explicit aliases that apply to one note. An entry with neither `workspaces` nor `notes` applies everywhere; with
 * both, either may match. A longer spelling still wins over a shorter one, which `scanPersonMentionsInProse` sorts out.
 */
export function aliasesFor(entries: readonly AliasEntry[], rel: string): PersonAlias[] {
  const workspace = workspaceOf(rel)
  return entries
    .filter((e) => {
      const byWorkspace = e.workspaces?.includes(workspace) === true
      const byNote = e.notes?.includes(rel) === true
      if (!e.workspaces && !e.notes) return true
      return byWorkspace || byNote
    })
    .map((e) => ({ text: e.text, name: e.person, short: true }))
}
