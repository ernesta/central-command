import { currentYear } from '../year'
import { contractToShow, type OpenContracts } from './contracts'
import { hasContracts } from './workspace-weeks'

/**
 * The year (its start) a workspace's tracking pages open on: Research and Life have one year at a time (`currentYear` of the
 * settings' starts); Work has contracts, and opens on the one `contractToShow` picks among those that hold today. `years` are the
 * starts that have files, newest first, and `open` the contracts holding today (null while not read: '' meanwhile, as the page
 * waits). `remembered` is the contract last shown, which only the page knows. One rule for the Hours page, Home and the Home summary.
 */
export function yearToShow(
  workspace: string,
  today: string,
  sources: {
    yearStarts: readonly string[]
    years: readonly string[] | null
    open: OpenContracts | null
    remembered?: string
  }
): string {
  if (!hasContracts(workspace)) return currentYear(today, sources.yearStarts)
  return sources.years && sources.open
    ? contractToShow(sources.years, today, sources.open, sources.remembered)
    : ''
}
