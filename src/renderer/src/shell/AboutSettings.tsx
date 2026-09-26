import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/api'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { Button } from '../components/Button'
import { Notice } from '../components/Notice'
import styles from './PathField.module.css'
import aboutStyles from './AboutSettings.module.css'

/** The app's version and where everything it keeps lives, with a way to open that folder. Same label and help layout as PathField. */
export function AboutSettings(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.app.info().then((value) => {
      if (!cancelled) setInfo(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const show = async (): Promise<void> => {
    setError(null)
    try {
      await window.api.app.revealData()
    } catch (e) {
      setError(`Couldn’t open the folder: ${ipcErrorMessage(e)}`)
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Your data</span>
      <p className={styles.help}>Everything you write is kept here as plain files.</p>
      <div className={styles.row}>
        <code className={aboutStyles.path}>{info?.dataDir ?? ''}</code>
        <Button className={aboutStyles.show} onClick={() => void show()} disabled={!info}>
          Show
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {info && (
        <p className={styles.help}>
          {info.name} {info.version}
        </p>
      )}
    </div>
  )
}
