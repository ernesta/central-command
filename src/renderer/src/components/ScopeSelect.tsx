import { Select } from './Select'

/**
 * A workspace's one filter as a dropdown: `[All …  ⌄]`, then each choice. It has no visible label of its own, the options say what it
 * is; `label` is for assistive tech. `ContractFilter` (Work) and `YearFilter` (Research) are this with their own words.
 */
export function ScopeSelect({
  label,
  all,
  scope,
  choices,
  onChange
}: {
  label: string
  /** The first option, which is `all`. */
  all: string
  scope: string
  choices: readonly { value: string; label: string }[]
  onChange: (scope: string) => void
}): React.JSX.Element {
  return (
    <Select
      label={label}
      value={scope}
      options={[{ value: 'all', label: all }, ...choices]}
      onChange={onChange}
    />
  )
}
