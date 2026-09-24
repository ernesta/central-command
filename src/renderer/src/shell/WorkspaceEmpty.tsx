import type { Workspace } from '@shared/settings'
import { EmptyState } from '../components/EmptyState'
import { WORKSPACE_LABELS } from './workspaces'

/** Placeholder for workspaces that have no modules yet. */
export function WorkspaceEmpty({ workspace }: { workspace: Workspace }): React.JSX.Element {
  return (
    <EmptyState
      heading="Nothing here yet"
      message={`This is where ${WORKSPACE_LABELS[workspace]} will live.`}
    />
  )
}
