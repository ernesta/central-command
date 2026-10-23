import { clearToast, pauseToast, resumeToast, useToast } from './toast-store'
import styles from './Toast.module.css'

/** `Deleted “Title” and 3:45 of time.` as the words before the title, the title, and what follows it. The title is the only part that gives way. */
function splitTitle(text: string): [string, string, string] | null {
  const open = text.indexOf('“')
  const close = text.lastIndexOf('”')
  if (open < 0 || close <= open) return null
  return [text.slice(0, open), text.slice(open + 1, close), text.slice(close + 1)]
}

/** The one toast message of the app, mounted once by the shell. Renders nothing when there is none to show. */
export function Toast(): React.JSX.Element | null {
  const toast = useToast()
  if (!toast) return null
  const parts = splitTitle(toast.text)
  return (
    <div
      // A new message starts the time bar again.
      key={toast.id}
      className={styles.toast}
      role="status"
      onPointerEnter={pauseToast}
      onPointerLeave={resumeToast}
    >
      <p className={styles.row}>
        {parts ? (
          <>
            <span className={styles.fixed}>{parts[0]}“</span>
            <span className={styles.title}>{parts[1]}</span>
            <span className={styles.fixed}>”{parts[2]}</span>
          </>
        ) : (
          <span className={styles.title}>{toast.text}</span>
        )}
      </p>
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
      <span className={styles.bar} style={{ animationDuration: `${toast.ms}ms` }} aria-hidden />
    </div>
  )
}
