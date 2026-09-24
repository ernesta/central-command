import { Search } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { Input } from './Input'
import styles from './SearchInput.module.css'

type SearchInputProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  label: string
}

/** A search field that grows on focus (and stays wide while it has text). */
export function SearchInput({
  value,
  onChange,
  label,
  ...rest
}: SearchInputProps): React.JSX.Element {
  return (
    <span className={styles.wrap}>
      <Search size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
      <Input
        type="search"
        className={styles.input}
        value={value}
        aria-label={label}
        placeholder="Search"
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
    </span>
  )
}
