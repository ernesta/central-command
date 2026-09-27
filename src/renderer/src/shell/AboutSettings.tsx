import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/api'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { Button } from '../components/Button'
import { Notice } from '../components/Notice'
import styles from './AboutSettings.module.css'

/** The app's version and where everything it keeps lives, with a way to open that folder. */
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
    <section className={styles.section} aria-labelledby="about-settings">
      <h2 id="about-settings" className={styles.heading}>
        About
      </h2>
      <div className={styles.field}>
        <span className={styles.label}>Your data</span>
        <p className={styles.help}>Everything you write is kept here as plain files.</p>
        <div className={styles.row}>
          <code className={styles.path}>{info?.dataDir ?? ''}</code>
          <Button className={styles.show} onClick={() => void show()} disabled={!info}>
            Show
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      {info && (
        <p className={styles.version}>
          {info.name} {info.version}
        </p>
      )}
    </section>
  )
}
