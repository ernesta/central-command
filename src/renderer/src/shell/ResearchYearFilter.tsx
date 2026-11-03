import { useLocation } from 'react-router'
import { useYearFilter } from '../state/use-year-filter'
import { YearFilter } from '../components/YearFilter'
import { showsYearFilter } from './research-year-pages'

/** Research's one academic year filter, in the top bar beside the workspace tabs, on the Research pages that follow it. */
export function ResearchYearFilter(): React.JSX.Element | null {
  const { pathname } = useLocation()
  const filter = useYearFilter('research')
  if (!showsYearFilter(pathname) || !filter.applies || filter.years.length === 0) return null
  return <YearFilter scope={filter.scope} years={filter.years} onChange={filter.setScope} />
}
