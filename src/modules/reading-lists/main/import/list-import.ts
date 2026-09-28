import { JSDOM } from 'jsdom'

/** One entry as read from the source document, before it is turned into a bullet line. */
interface SourceEntry {
  /** The section (question) it sits under. */
  heading: string
  /** Its full plain text, exactly as `textContent` gives it (tags stripped, entities decoded). */
  text: string
}

export interface ListImportEntry {
  citation: string
  annotation: string
}

export interface ListImportSection {
  heading: string
  entries: ListImportEntry[]
}

export interface ListImportResult {
  sections: ListImportSection[]
  /** The Markdown body: one `##` heading per section, one bullet per entry. */
  body: string
  sectionCount: number
  entryCount: number
  /** Entries the safety check could not account for, or that had no annotation. Nothing is dropped for these. */
  problems: string[]
}

/** The separator this list's author uses between a citation and its annotation: an en dash with spaces
 *  round it. Page ranges inside a citation ("638–660") use the same dash with no spaces, so they never match. */
const SEPARATOR = /\s+–\s+/

/** Splits one entry's plain text into its citation and annotation at the first `SEPARATOR`. */
function splitEntry(text: string): ListImportEntry {
  const match = SEPARATOR.exec(text)
  if (!match) return { citation: text, annotation: '' }
  return {
    citation: text.slice(0, match.index).trim(),
    annotation: text.slice(match.index + match[0].length).trim()
  }
}

/**
 * Reads the list's structure out of `textutil -convert html`'s output: a `<p>` that is entirely bold
 * starts a new section (its text is the heading, written as a question), and the `<li>`s of the `<ul>`
 * that follows are that section's entries. A `<li>` before any heading is dropped and reported, the way
 * every importer in this app leaves out what it cannot place rather than guessing.
 */
function readSource(html: string): { entries: SourceEntry[]; problems: string[] } {
  const dom = new JSDOM(html)
  const entries: SourceEntry[] = []
  const problems: string[] = []
  let heading: string | null = null

  for (const el of dom.window.document.body.children) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text === '') continue
    if (el.tagName === 'P') {
      const bold = el.querySelector('b')
      const isHeading =
        bold !== null && (bold.textContent ?? '').replace(/\s+/g, ' ').trim() === text
      if (isHeading) {
        heading = text.replace(/\.$/, '')
        continue
      }
      problems.push(`A paragraph outside any section was ignored: "${text.slice(0, 60)}…"`)
    } else if (el.tagName === 'UL') {
      for (const li of el.querySelectorAll('li')) {
        const entryText = (li.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (entryText === '') continue
        if (heading === null) {
          problems.push(
            `An entry before any section heading was dropped: "${entryText.slice(0, 60)}…"`
          )
          continue
        }
        entries.push({ heading, text: entryText })
      }
    }
  }
  return { entries, problems }
}

function bulletLine({ citation, annotation }: ListImportEntry): string {
  return annotation === '' ? `- **${citation}**` : `- **${citation}** ${annotation}`
}

/**
 * Turns the HTML of a converted reading-list document into the sections and entries a reading list's
 * body holds, plus the Markdown itself. Every entry is a `placeholder` citation (kept as plain text, not
 * linked to a reading): the app's own "Attach a reading" picker is how each is matched by hand, the same
 * way every other importer in this app leaves a matching decision to the user rather than guessing it.
 *
 * `split` is injected only so a test can break it (a mutation check); real callers never pass it.
 */
export function planListImport(html: string, split = splitEntry): ListImportResult {
  const { entries: sourceEntries, problems } = readSource(html)

  const byHeading = new Map<string, ListImportEntry[]>()
  const order: string[] = []
  for (const source of sourceEntries) {
    const entry = split(source.text)
    if (entry.annotation === '') {
      problems.push(
        `No annotation found (kept as the whole citation): "${entry.citation.slice(0, 60)}…"`
      )
    }
    // The safety check: what the bullet line will read back as (ignoring the bold markers, which are
    // this format's own syntax, not part of the source text) must equal the source text exactly.
    const roundTrip =
      entry.annotation === '' ? entry.citation : `${entry.citation} – ${entry.annotation}`
    if (roundTrip !== source.text) {
      throw new Error(
        `Safety check failed for an entry under "${source.heading}": the converted text does not match the source.\n` +
          `Source:    ${source.text}\nConverted: ${roundTrip}`
      )
    }
    if (!byHeading.has(source.heading)) {
      byHeading.set(source.heading, [])
      order.push(source.heading)
    }
    byHeading.get(source.heading)!.push(entry)
  }

  const sections: ListImportSection[] = order.map((heading) => ({
    heading,
    entries: byHeading.get(heading) ?? []
  }))

  const body =
    sections
      .map((section) => `## ${section.heading}\n\n${section.entries.map(bulletLine).join('\n')}`)
      .join('\n\n') + '\n'

  return {
    sections,
    body,
    sectionCount: sections.length,
    entryCount: sourceEntries.length,
    problems
  }
}
