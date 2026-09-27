import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { isSafeLinkUrl, type PersonLink } from '@shared/people'
import styles from './PersonLinks.module.css'

const PRESETS = ['Google Scholar', 'GitHub', 'Website', 'LinkedIn']

/** A person's own links (Google Scholar, GitHub, a website…), shown and edited on their page. */
export function PersonLinks({
  links,
  onChange
}: {
  links: PersonLink[]
  onChange: (links: PersonLink[]) => void
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  const reset = (): void => {
    setAdding(false)
    setLabel('')
    setUrl('')
  }
  const add = (): void => {
    if (label.trim() === '' || !isSafeLinkUrl(url.trim())) return
    onChange([...links, { label: label.trim(), url: url.trim() }])
    reset()
  }
  const remove = (i: number): void => onChange(links.filter((_, j) => j !== i))

  return (
    <div className={styles.section}>
      <p className={styles.label}>Links</p>
      {links.length > 0 && (
        <ul className={styles.list}>
          {links.map((link, i) => (
            <li key={`${link.label}-${link.url}`} className={styles.row}>
              <a className={styles.link} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${link.label}`}
                onClick={() => remove(i)}
              >
                <X size={13} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.presets}>
            {PRESETS.map((preset) => (
              <Button key={preset} size="small" onClick={() => setLabel(preset)}>
                {preset}
              </Button>
            ))}
          </div>
          <input
            className={styles.input}
            placeholder="Label"
            aria-label="Link label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <input
            className={styles.input}
            placeholder="https://…"
            aria-label="Link URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add()
              else if (event.key === 'Escape') reset()
            }}
          />
          <div className={styles.actions}>
            <Button
              size="small"
              variant="primary"
              disabled={label.trim() === '' || !isSafeLinkUrl(url.trim())}
              onClick={add}
            >
              Add
            </Button>
            <Button size="small" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="small"
          className={styles.addButton}
          icon={<Plus size={13} strokeWidth={1.75} aria-hidden />}
          onClick={() => setAdding(true)}
        >
          Add link
        </Button>
      )}
    </div>
  )
}
