import type { ComponentPropsWithRef, ReactNode } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'default' | 'small'
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'default',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps): React.JSX.Element {
  const classes = [styles.button, styles[variant], size === 'small' && styles.small, className]
  return (
    <button type={type} className={classes.filter(Boolean).join(' ')} {...rest}>
      {icon}
      {children}
    </button>
  )
}
