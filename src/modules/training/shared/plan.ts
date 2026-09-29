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
