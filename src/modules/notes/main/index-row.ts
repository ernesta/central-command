import { hashContent } from '../../../main/notes/guarded-file'
import { markdownToExcerpt } from '../../../main/notes/excerpt'
import { parseMeta, splitNote } from '../shared/front-matter'
import type { NoteIndexRow, NoteWorkspace } from '../shared/types'

const EXCERPT_LENGTH = 4000
const FIRST_LINE_LENGTH = 120

/** The first line of the body that has any words in it, without Markdown marks. */
export function firstLineOf(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const text = markdownToExcerpt(line, FIRST_LINE_LENGTH)
    if (text) return text
  }
  return ''
}

/**
 * Work out what the index should say about a note file. Pure: the same text and modified time always give
 * the same row, which is what lets the index be rebuilt from the files at any time.
 */
export function buildIndexRow(
  workspace: NoteWorkspace,
  id: string,
  content: string,
  edited: number
): NoteIndexRow {
  const { head, body } = splitNote(content)
  const { meta, problems } = parseMeta(head)
  return {
    workspace,
    id,
    title: meta.title,
    group: meta.group,
    subgroup: meta.subgroup,
    pinned: meta.pinned,
    created: meta.created,
    edited: Math.floor(edited),
    firstLine: firstLineOf(body),
    excerpt: markdownToExcerpt(body, EXCERPT_LENGTH),
    problems,
    contentHash: hashContent(content)
  }
}
