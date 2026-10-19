import { NEW_TRAINING_BODY } from './front-matter'
import type { TrainingMeta } from './types'

const lines = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')

/**
 * Whether a training entry is still exactly what New training entry made: no title (or "Untitled"), no times, series, type, format,
 * skills, leads, institution, folder, organisation or points, no task made for it, and a body that is the template's headings only
 * (blank lines aside). The date is not a change (it is prefilled with today's). Leaving such an entry removes it.
 */
export function isUntouchedTraining(meta: TrainingMeta, body: string): boolean {
  return (
    (meta.title.trim() === '' || meta.title.trim() === 'Untitled') &&
    meta.start === null &&
    meta.end === null &&
    !meta.series &&
    !meta.type &&
    meta.mode === null &&
    meta.skills.length === 0 &&
    meta.leads.length === 0 &&
    !meta.institution &&
    !meta.folder &&
    !meta.organisation &&
    !meta.points &&
    (meta.task === '' || meta.task === 'auto') &&
    meta.selfStudy === '' &&
    lines(body) === lines(NEW_TRAINING_BODY)
  )
}
