import { peopleRoute } from '@modules/meetings/renderer/meetings-paths'
import { AllLink } from '../components/Landing'
import { WorkspaceLanding } from './WorkspaceLanding'

export function ResearchLanding(): React.JSX.Element {
  return (
    <WorkspaceLanding workspace="research" actions={<AllLink to={peopleRoute}>People</AllLink>} />
  )
}
