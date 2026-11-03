import { useLocation } from 'react-router'
import { useContractFilter } from '../state/use-contract-filter'
import { ContractFilter } from '../components/ContractFilter'

import { showsContractFilter } from './contract-filter-pages'

/** Work's one contract filter, in the top bar beside the workspace tabs, on the Work pages that follow it. */
export function WorkContractFilter(): React.JSX.Element | null {
  const { pathname } = useLocation()
  const filter = useContractFilter('work')
  if (!showsContractFilter(pathname) || !filter.applies || filter.starts.length === 0) return null
  return <ContractFilter scope={filter.scope} starts={filter.starts} onChange={filter.setScope} />
}
