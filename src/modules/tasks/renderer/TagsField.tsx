import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { PickerPopup } from '@renderer/components/Picker'
import { Tooltip } from '@renderer/components/Tooltip'
import { normaliseTag } from '../shared/tag'
import styles from './TagsField.module.css'

/**
 * A task's tags as chips you can remove, and the shared picker (under the "+ Tag" button) to add from or to make a new
 * one. The list stays open after each tag, so several can be added in a row; Escape closes it. With a `limit` (a table
 * row) the first tags show and the rest are a muted "+N" whose tooltip lists them.
 */
export function TagsField({
  tags,
  onChange,
  inline = false,
  limit,
  suggestions = []
}: {
  tags: readonly string[]
  onChange: (tags: string[]) => void
  /** Sits in a line of text (a table row); the "+ Tag" button carries `data-tag-add` so the host can show it on hover. */
  inline?: boolean
  /** Show at most this many tags, then "+N". */
  limit?: number
  /** Tags already in use elsewhere; offered in the list (the ones this task has are left out). */
  suggestions?: readonly string[]
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // Bumped after each pick: the list opens afresh, without the tag just added.
  const [round, setRound] = useState(0)
  const addRef = useRef<HTMLButtonElement>(null)

  const sorted = [...tags].sort((a, b) => a.localeCompare(b))
  const shown = limit === undefined ? sorted : sorted.slice(0, limit)
  const rest = sorted.slice(shown.length)
  const options = [...new Set(suggestions)]
    .filter((t) => !tags.includes(t))
    .sort((a, b) => a.localeCompare(b))
    .map((t) => ({ value: t, label: t }))

  return (
    <div className={[styles.tags, inline && styles.inline].filter(Boolean).join(' ')}>
      {shown.map((tag) => (
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
      {rest.length > 0 && (
        <Tooltip text={rest.join(', ')}>
          <span className={styles.more}>+{rest.length}</span>
        </Tooltip>
      )}
      <button
        ref={addRef}
        type="button"
        className={styles.add}
        data-tag-add
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setRound((r) => r + 1)
          setOpen((o) => !o)
        }}
      >
        <Plus size={12} strokeWidth={2} aria-hidden />
        Tag
      </button>
      {open && (
        <PickerPopup
          key={round}
          anchorRef={addRef}
          minWidth={220}
          options={options}
          alwaysSearch
          label="Add a tag"
          noun="tags"
          onPick={(tag) => onChange([...tags, tag])}
          add={{
            label: (text) => `Add “${normaliseTag(text)}”`,
            canAdd: (text) => normaliseTag(text) !== '',
            onAdd: (text) => {
              const tag = normaliseTag(text)
              if (tag && !tags.includes(tag)) onChange([...tags, tag])
            }
          }}
          onClose={(reason) => {
            if (reason === 'pick') {
              // Straight back to the list, for the next tag.
              setRound((r) => r + 1)
              return
            }
            setOpen(false)
            if (reason !== 'outside') addRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
