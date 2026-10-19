import type { Completion, CompletionOption } from '@shared/search-complete'
import styles from './CompletionList.module.css'

/** The options for the word being typed in a search field. The field keeps focus; the mouse picks without taking it. */
export function CompletionList({
  id,
  completion,
  active,
  onPick,
  floating = false
}: {
  id: string
  completion: Completion
  active: number
  onPick: (option: CompletionOption) => void
  /** Drawn over the page under the field (the results page), rather than as the first rows of the window. */
  floating?: boolean
}): React.JSX.Element {
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Filters"
      className={[styles.list, floating && styles.floating].filter(Boolean).join(' ')}
    >
      {completion.options.map((option, index) => (
        <button
          key={option.insert}
          type="button"
          tabIndex={-1}
          role="option"
          id={`${id}-${index}`}
          aria-selected={index === active}
          className={[styles.option, index === active && styles.active].filter(Boolean).join(' ')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(option)}
        >
          <span className={styles.label}>{option.label}</span>
          {option.hint && <span className={styles.hint}>{option.hint}</span>}
        </button>
      ))}
    </div>
  )
}
