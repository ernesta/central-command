import { startYearLabel } from '@shared/year'

const FILE_NAME = /^Training plan (\d{4})-\d{2}\.md$/
/** A plan is kept per year under the calendar year the year starts in (2026 for the year starting 21 Sep 2026). */
export function planKey(yearStart: string): number {
  return Number(yearStart.slice(0, 4))
}

/** The plan's file name for a plan key, for example "Training plan 2026-27.md". */
export function planFileName(key: number): string {
  return `Training plan ${startYearLabel(key).replace('–', '-')}.md`
}

/** The plan key a plan file belongs to, or null when the name is not a plan's. */
export function planYearFromFileName(fileName: string): number | null {
  const match = FILE_NAME.exec(fileName)
  return match ? Number(match[1]) : null
}
