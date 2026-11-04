import { markdownToExcerpt } from '@shared/text'
import { markdownHtml, noteFooter, notePageHtml } from '../../meetings/shared/note-html'
import { UNTITLED } from './query'
import type { NoteMeta } from './types'

/** The page's heading: the title, else the note's first line, like the note's own page. */
export function noteExportTitle(meta: Pick<NoteMeta, 'title'>, body: string): string {
  return meta.title || markdownToExcerpt(body, 40) || UNTITLED
}

/** The footer on every page: the note's title and the page count (the same as a meeting's). */
export const noteExportFooter = noteFooter

/** The name suggested when saving: "Methods participants.pdf". */
export function noteExportFileName(title: string): string {
  const name = title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${name || UNTITLED}.pdf`
}

/** "Group · Subgroup" on one line, or nothing for an ungrouped note. */
export function noteExportDetails(meta: Pick<NoteMeta, 'group' | 'subgroup'>): string {
  return [meta.group, meta.subgroup].filter((part) => part).join(' · ')
}

/** The whole page for one note: its title, its group, then its text. */
export function noteExportHtml(input: { meta: NoteMeta; body: string }): string {
  const { meta, body } = input
  return notePageHtml({
    title: noteExportTitle(meta, body),
    details: noteExportDetails(meta),
    bodyHtml: markdownHtml(body)
  })
}
