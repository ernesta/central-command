import { Select } from './Select'

export type MovableWorkspace = 'research' | 'work'

const OPTIONS = [
  { value: 'research', label: 'Research' },
  { value: 'work', label: 'Work' }
] as const

/**
 * Which workspace a note or meeting belongs to. Choosing the other one moves it there; the page does the moving.
 * Used on every kind of page that can live in more than one workspace, so it looks and sits the same on each.
 */
export function WorkspaceSelect({
  value,
  onChange,
  disabled,
  compact
}: {
  value: MovableWorkspace
  onChange: (workspace: MovableWorkspace) => void
  disabled?: boolean
  compact?: boolean
}): React.JSX.Element {
  return (
    <Select<MovableWorkspace>
      label="Workspace"
      value={value}
      options={OPTIONS}
      disabled={disabled}
      compact={compact}
      onChange={onChange}
    />
  )
}
