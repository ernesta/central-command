import { hashContent } from '../../../main/notes/guarded-file'
import { SEARCH_TEXT_LENGTH, markdownToExcerpt } from '../../../main/notes/excerpt'
import { parseListBody } from '../shared/list-body'
import { parseMeta, splitNote } from '../shared/front-matter'
import type { ReadingListIndexRow, ReadingListWorkspace } from '../shared/types'

export interface MentionRow {
  workspace: ReadingListWorkspace
  listId: string
  listTitle: string
  section: string
  citekey: string
  annotation: string
}

/**
 * Work out what the index should say about a list file, and every reading it names. Pure: the same
 * text and modified time always give the same rows, which is what lets the index be rebuilt from the
 * files at any time.
 */
export function buildIndexRow(
  workspace: ReadingListWorkspace,
  id: string,
  content: string,
  edited: number
): { row: ReadingListIndexRow; mentions: MentionRow[] } {
  const { head, body } = splitNote(content)
  const { meta } = parseMeta(head)
  const sections = parseListBody(body)
  const mentions: MentionRow[] = sections.flatMap((section) =>
    section.entries
      .filter((e) => e.kind === 'linked')
      .map((e) => ({
        workspace,
        listId: id,
        listTitle: meta.title || 'Untitled list',
        section: section.heading,
        citekey: e.citekey,
        annotation: e.annotation
      }))
  )
  const row: ReadingListIndexRow = {
    workspace,
    id,
    title: meta.title,
    edited: Math.floor(edited),
    sectionCount: sections.length,
    entryCount: sections.reduce((n, s) => n + s.entries.length, 0),
    excerpt: markdownToExcerpt(body, SEARCH_TEXT_LENGTH),
    contentHash: hashContent(content)
  }
  return { row, mentions }
}
