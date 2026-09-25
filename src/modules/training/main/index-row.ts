import { markdownToExcerpt } from '../../../main/notes/excerpt'
import { hashContent } from '../../../main/notes/guarded-file'
import { extractSection } from '@shared/sections'
import { isValidDate, parseTrainingMeta, splitNote } from '../shared/front-matter'
import type { TrainingIndexRow, TrainingWorkspace } from '../shared/types'
import { dateFromBaseName } from './file-name'

const SUMMARY_LENGTH = 1000
const EXCERPT_LENGTH = 4000

/**
 * Work out what the index should say about an entry file. Pure: the same text always gives the same
 * row, which is what lets the index be rebuilt from the files at any time.
 */
export function buildTrainingIndexRow(
  workspace: TrainingWorkspace,
  id: string,
  content: string
): TrainingIndexRow {
  const { head, body } = splitNote(content)
  const { meta, problems } = parseTrainingMeta(head)

  let date = meta.date
  if (!date) {
    const fromName = dateFromBaseName(id)
    if (fromName && isValidDate(fromName)) {
      date = fromName
      problems.push('Date taken from the file name')
    }
  }

  const notes = markdownToExcerpt(extractSection(body, 'Notes') ?? '', SUMMARY_LENGTH)
  return {
    workspace,
    id,
    date,
    start: meta.start,
    end: meta.end,
    title: meta.title,
    series: meta.series,
    type: meta.type,
    mode: meta.mode,
    skills: meta.skills,
    leads: meta.leads,
    institution: meta.institution,
    folder: meta.folder,
    summary: markdownToExcerpt(extractSection(body, 'Summary') ?? '', SUMMARY_LENGTH),
    excerpt: markdownToExcerpt(body, EXCERPT_LENGTH),
    hasNotes: notes !== '',
    problems,
    contentHash: hashContent(content)
  }
}
