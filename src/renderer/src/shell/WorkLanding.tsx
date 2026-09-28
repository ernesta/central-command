import { peopleRoute } from '@modules/meetings/renderer/meetings-paths'
import { AllLink } from '../components/Landing'
import { WorkspaceLanding } from './WorkspaceLanding'

/** People are shared with Research, not a separate Work list, so the same link opens the same page. */
export function WorkLanding(): React.JSX.Element {
  return <WorkspaceLanding workspace="work" actions={<AllLink to={peopleRoute}>People</AllLink>} />
}
