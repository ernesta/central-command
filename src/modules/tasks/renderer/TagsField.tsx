import { X } from 'lucide-react'
import { useState } from 'react'
import styles from './TagsField.module.css'

/** A task's tags as chips you can remove, and a small field to add one. */
export function TagsField({
  tags,
  onChange
}: {
  tags: readonly string[]
  onChange: (tags: string[]) => void
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  const add = (): void => {
    const tag = text.trim().toLowerCase()
    setText('')
    setAdding(false)
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
  }

  return (
    <div className={styles.tags}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove tag ${tag}`}
            onClick={() => onChange(tags.filter((t) => t !== tag))}
          >
            <X size={12} strokeWidth={2} aria-hidden />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          className={styles.input}
          aria-label="New tag"
          placeholder="Tag"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setText('')
              setAdding(false)
            }
          }}
        />
      ) : (
        <button type="button" className={styles.add} onClick={() => setAdding(true)}>
          + Tag
        </button>
      )}
    </div>
  )
}
