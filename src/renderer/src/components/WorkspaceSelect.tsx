import { Select } from './Select'

export type MovableWorkspace = 'life' | 'research' | 'work'

const LABELS: Record<MovableWorkspace, string> = {
  life: 'Life',
  research: 'Research',
  work: 'Work'
}

/** What meetings can move between; notes offer Life as well. */
export const MEETING_WORKSPACES = ['research', 'work'] as const
export const NOTE_WORKSPACE_CHOICES = ['life', 'research', 'work'] as const

/**
 * Which workspace a note or meeting belongs to. Choosing the other one moves it there; the page does the moving.
 * Used on every kind of page that can live in more than one workspace, so it looks and sits the same on each.
 */
export function WorkspaceSelect<W extends MovableWorkspace = 'research' | 'work'>({
  value,
  onChange,
  disabled,
  compact,
  workspaces = MEETING_WORKSPACES as unknown as readonly W[]
}: {
  value: W
  onChange: (workspace: W) => void
  disabled?: boolean
  compact?: boolean
  workspaces?: readonly W[]
}): React.JSX.Element {
  return (
    <Select<W>
      label="Workspace"
      value={value}
      options={workspaces.map((value) => ({ value, label: LABELS[value] }))}
      disabled={disabled}
      compact={compact}
      onChange={onChange}
    />
  )
}
