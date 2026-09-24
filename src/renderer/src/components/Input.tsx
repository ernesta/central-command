import type { ComponentPropsWithRef } from 'react'
import styles from './Input.module.css'

export function Input({ className, ...rest }: ComponentPropsWithRef<'input'>): React.JSX.Element {
  return <input className={[styles.input, className].filter(Boolean).join(' ')} {...rest} />
}
