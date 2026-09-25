import { academicYearLabel } from '@shared/academic-year'

const FILE_NAME = /^Training plan (\d{4})-\d{2}\.md$/

/** The plan's file name for an academic year (its start year), for example "Training plan 2026-27.md". */
export function planFileName(year: number): string {
  return `Training plan ${academicYearLabel(year).replace('–', '-')}.md`
}

/** The academic year a plan file belongs to, or null when the name is not a plan's. */
export function planYearFromFileName(fileName: string): number | null {
  const match = FILE_NAME.exec(fileName)
  return match ? Number(match[1]) : null
}

export interface OutlineItem {
  /** 2 for a group heading (Priority 1), 3 for an item under it. Other levels are ignored. */
  level: 2 | 3
  text: string
}

/** Plain text of a heading: emphasis marks, code ticks and link syntax removed. */
function plainHeading(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

/** The `##` and `###` headings of a plan, in order, for the outline beside it. Headings inside code fences are skipped. */
export function planOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = []
  let fenced = false
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (!match) continue
    const text = plainHeading(match[2])
    if (text) items.push({ level: match[1].length as 2 | 3, text })
  }
  return items
}
