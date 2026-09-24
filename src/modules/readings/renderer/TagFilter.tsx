import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@renderer/components/Input'
import type { TagCount } from '../shared/query'
import styles from './TagFilter.module.css'

interface TagFilterProps {
  tags: TagCount[]
  selected: string[]
  onChange: (selected: string[]) => void
}

const norm = (text: string): string => text.toLowerCase()

/** Multi-select tag filter. A reading must have every selected tag. */
export function TagFilter({ tags, selected, onChange }: TagFilterProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const selectedKeys = useMemo(() => new Set(selected.map(norm)), [selected])
  const visible = useMemo(() => {
    const needle = norm(filter.trim())
    return tags.filter((t) => !needle || norm(t.tag).includes(needle))
  }, [tags, filter])

  const toggle = (tag: string): void => {
    const key = norm(tag)
    onChange(selectedKeys.has(key) ? selected.filter((s) => norm(s) !== key) : [...selected, tag])
  }

  const close = (): void => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onKeyDown={(event) => event.key === 'Escape' && open && close()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, selected.length > 0 && styles.active].filter(Boolean).join(' ')}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {selected.length > 0 ? `Tags · ${selected.length}` : 'Tags'}
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div className={styles.popover}>
          <Input
            autoFocus
            type="search"
            aria-label="Filter tags"
            placeholder="Filter tags"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <ul id={listId} className={styles.list} aria-label="Tags">
            {visible.map(({ tag, count }) => (
              <li key={tag}>
                <label className={styles.option}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(norm(tag))}
                    onChange={() => toggle(tag)}
                  />
                  {tag}
                  <span className={styles.count}>{count}</span>
                </label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className={styles.empty}>
                {tags.length === 0 ? 'No tags yet' : 'No matching tags'}
              </li>
            )}
          </ul>
          <div className={styles.footer}>
            <span>Readings must have all selected tags</span>
            <button
              type="button"
              className={styles.clear}
              disabled={selected.length === 0}
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
