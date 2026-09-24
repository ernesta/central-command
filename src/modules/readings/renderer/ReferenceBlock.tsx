import { Check, Copy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { copyRichText } from '@renderer/lib/clipboard'
import { formatApa } from '../shared/apa'
import type { Reading } from '../shared/types'
import styles from './ReferenceBlock.module.css'

/** The reading's APA 7 reference, with one click to copy it (italics included) for pasting into a manuscript. */
export function ReferenceBlock({ reading }: { reading: Reading }): React.JSX.Element {
  const reference = useMemo(() => formatApa(reading), [reading])
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const copy = async (): Promise<void> => {
    try {
      await copyRichText(reference)
      setState('copied')
    } catch {
      setState('failed')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  return (
    <section className={styles.block} aria-label="APA reference">
      <div className={styles.header}>
        <h2 className={styles.label}>APA reference</h2>
        <span className={styles.status} role="status">
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy' : ''}
        </span>
        <Button
          size="small"
          icon={
            state === 'copied' ? (
              <Check size={14} strokeWidth={1.75} aria-hidden />
            ) : (
              <Copy size={14} strokeWidth={1.75} aria-hidden />
            )
          }
          onClick={() => void copy()}
        >
          Copy
        </Button>
      </div>
      {/* The HTML is produced by formatApa, which escapes all text; only <i> tags are added. */}
      <p className={styles.text} dangerouslySetInnerHTML={{ __html: reference.html }} />
    </section>
  )
}
