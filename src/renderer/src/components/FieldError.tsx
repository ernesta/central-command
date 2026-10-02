import styles from './FieldError.module.css'

/** A refusal shown right under the field it is about: small, red, wrapping inside its cell. */
export function FieldError({ message }: { message: string }): React.JSX.Element {
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  )
}
