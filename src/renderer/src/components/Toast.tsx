import { clearToast, useToast } from './toast-store'
import styles from './Toast.module.css'

/** The one toast message of the app, mounted once by the shell. Renders nothing when there is none to show. */
export function Toast(): React.JSX.Element | null {
  const toast = useToast()
  if (!toast) return null
  return (
    <div className={styles.toast} role="status">
      {toast.text}
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.run()
            clearToast()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
