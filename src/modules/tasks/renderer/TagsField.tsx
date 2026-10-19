import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { useUndoableRemoval } from '@renderer/components/useUndoableRemoval'
import { normaliseTag } from '../shared/tag'
import styles from './TagsField.module.css'

/** A task's tags as chips you can remove, and a small field to add one. */
export function TagsField({
  tags,
  onChange,
  inline = false,
  suggestions = []
}: {
  tags: readonly string[]
  onChange: (tags: string[]) => void
  /** Sits in a line of text (a table row); the "+ Tag" button carries `data-tag-add` so the host can show it on hover. */
  inline?: boolean
  /** Tags already in use elsewhere; offered as a list while typing (the ones this task has are left out). */
  suggestions?: readonly string[]
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const listId = useId()
  const removeTag = useUndoableRemoval(tags, onChange, undefined, (tag) => `the tag ${tag}`)

  const add = (): void => {
    const tag = normaliseTag(text)
    setText('')
    setAdding(false)
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
  }

  return (
    <div className={[styles.tags, inline && styles.inline].filter(Boolean).join(' ')}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove tag ${tag}`}
            onClick={() => removeTag(tag)}
          >
            <X size={12} strokeWidth={2} aria-hidden />
          </button>
        </span>
      ))}
      {adding ? (
        <>
          <input
            autoFocus
            className={styles.input}
            aria-label="New tag"
            placeholder="Tag"
            list={listId}
            value={text}
            onChange={(event) => setText(event.target.value.replace(/\s/gu, ''))}
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
          <datalist id={listId}>
            {suggestions
              .filter((t) => !tags.includes(t))
              .map((t) => (
                <option key={t} value={t} />
              ))}
          </datalist>
        </>
      ) : (
        <button type="button" className={styles.add} data-tag-add onClick={() => setAdding(true)}>
          + Tag
        </button>
      )}
    </div>
  )
}
