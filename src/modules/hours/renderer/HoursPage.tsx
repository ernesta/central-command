import { YearSelect } from '@renderer/components/YearSelect'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { useHoursWorkspace } from './hours-paths'

/** The Hours page: the year selector in the header, then Today, the week and the balance. */
export function HoursPage(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { year, years, setYear } = useTrackingYear(workspace)

  return (
    <LandingPage>
      <LandingHeader
        backTo={`/${workspace}`}
        backLabel={WORKSPACE_LABELS[workspace]}
        title="Hours"
        actions={<YearSelect year={year} years={years} onChange={setYear} />}
      />
    </LandingPage>
  )
}
