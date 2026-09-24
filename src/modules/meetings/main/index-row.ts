import { hashContent } from '../../../main/notes/guarded-file'
import { markdownToExcerpt } from '../../../main/notes/excerpt'
import { parseMeta, splitNote, isValidDate } from '../shared/front-matter'
import { extractSection } from '../shared/sections'
import { parseTodos } from '../shared/todos'
import type { MeetingIndexRow, MeetingWorkspace } from '../shared/types'
import { dateFromBaseName } from './file-name'

const SUMMARY_LENGTH = 1000
const EXCERPT_LENGTH = 4000

/**
 * Work out what the index should say about a meeting file. Pure: the same text always gives the same
 * row, which is what lets the index be rebuilt from the files at any time.
 */
export function buildIndexRow(
  workspace: MeetingWorkspace,
  id: string,
  content: string
): MeetingIndexRow {
  const { head, body } = splitNote(content)
  const { meta, problems } = parseMeta(head)

  let date = meta.date
  if (!date) {
    const fromName = dateFromBaseName(id)
    if (fromName && isValidDate(fromName)) {
      date = fromName
      problems.push('Date taken from the file name')
    }
  }

  const summary = markdownToExcerpt(extractSection(body, 'Summary') ?? '', SUMMARY_LENGTH)
  return {
    workspace,
    id,
    series: meta.series,
    date,
    start: meta.start,
    end: meta.end,
    mode: meta.mode,
    attendees: meta.attendees,
    summary,
    excerpt: markdownToExcerpt(body, EXCERPT_LENGTH),
    problems,
    todos: parseTodos(body),
    contentHash: hashContent(content)
  }
}
