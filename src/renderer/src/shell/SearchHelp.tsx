import type { UserValues } from '@shared/search-complete'
import { summarise } from '@shared/search-help'
import type { ModifierName } from '@shared/search-query'
import { ModifierChip } from './ModifierChip'
import styles from './SearchHelp.module.css'

const PEOPLE_SHOWN = 4

/**
 * The row under the field for the modifier being typed: its accepted values as chips (a fixed set; click to fill one in),
 * or one muted line of the forms it accepts, and for `with:` and `by:` a few people.
 */
export function SearchHelp({
  modifier,
  values,
  onFill
}: {
  modifier: ModifierName
  values: UserValues
  onFill: (insert: string) => void
}): React.JSX.Element {
  const help = summarise(modifier)
  const people = help.people ? (values[modifier] ?? []).slice(0, PEOPLE_SHOWN) : []
  return (
    <p className={styles.help} id="global-search-help">
      <span className={styles.name}>{modifier}:</span>
      {help.chips.map((chip) => (
        <ModifierChip key={chip.label} label={chip.label} onClick={() => onFill(chip.insert)} />
      ))}
      {help.line && <span>{help.line}</span>}
      {people.map((person) => (
        <ModifierChip
          key={person.label}
          label={person.label}
          onClick={() => onFill(person.insert)}
        />
      ))}
    </p>
  )
}
