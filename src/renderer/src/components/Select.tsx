import { Picker, type PickerOption } from './Picker'

/** An option of a select; a `description` shows as a quiet second line in the open list. */
export type SelectOption<T extends string> = PickerOption<T>

interface SelectProps<T extends string> {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  /** Required: selects usually have no visible label of their own. */
  label: string
  compact?: boolean
  className?: string
  disabled?: boolean
  id?: string
  title?: string
  /** The plural noun for the search placeholder: "types" gives "Search types". */
  noun?: string
  /** Always search, however few the options (a list of more than seven searches by itself). */
  search?: boolean
}

/**
 * Choose one of a list. A thin wrapper over `Picker`, which every list in the app shares: a list of more than seven
 * options (or one asked to `search`) opens with a search field, a shorter one is a plain list you can type a letter into.
 */
export function Select<T extends string>({ search, ...rest }: SelectProps<T>): React.JSX.Element {
  return <Picker<T> {...rest} alwaysSearch={search} />
}
