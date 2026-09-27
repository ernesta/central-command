import { academicYearLabel } from '@shared/academic-year'
import { markdownOutline, type OutlineItem } from '@shared/markdown-outline'

export type { OutlineItem }

const FILE_NAME = /^Training plan (\d{4})-\d{2}\.md$/
/** The plan's own structure: a `##` priority group, `###` items under it. */
const PLAN_OUTLINE_LEVELS = [2, 3]

/** The plan's file name for an academic year (its start year), for example "Training plan 2026-27.md". */
export function planFileName(year: number): string {
  return `Training plan ${academicYearLabel(year).replace('–', '-')}.md`
}

/** The academic year a plan file belongs to, or null when the name is not a plan's. */
export function planYearFromFileName(fileName: string): number | null {
  const match = FILE_NAME.exec(fileName)
  return match ? Number(match[1]) : null
}

/** The `##` and `###` headings of a plan, in order, for the outline beside it. Headings inside code fences are skipped. */
export function planOutline(markdown: string): OutlineItem[] {
  return markdownOutline(markdown, PLAN_OUTLINE_LEVELS)
}
