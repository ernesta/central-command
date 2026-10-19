import { Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import {
  MAX_SKILLS,
  SKILLS,
  SKILL_TAG_LABELS,
  SKILL_TAG_ORDER,
  findSkill,
  sortSkills
} from '@shared/skills'
import styles from './SkillsField.module.css'
import { useUndoableRemoval } from './useUndoableRemoval'

interface SkillsFieldProps {
  skills: string[]
  onChange: (skills: string[]) => void
}

/**
 * The skills of an entry as chips (at most three), with a small menu of the shared skills list to add
 * from. A name in the file that is not on the list is shown outlined and can be removed, never invented.
 */
export function SkillsField({ skills, onChange }: SkillsFieldProps): React.JSX.Element {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const popRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const removeSkill = useUndoableRemoval(skills, onChange, undefined, (name) => name)
  const addRef = useRef<HTMLButtonElement>(null)
  const full = skills.length >= MAX_SKILLS

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    popRef.current?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (open)
      popRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const chosen = new Set(skills)
  // The menu's options in the order shown, so the arrows walk them across the groups.
  const flat = SKILL_TAG_ORDER.flatMap((tag) =>
    SKILLS.filter((s) => s.tag === tag && !chosen.has(s.name))
  )
  const pick = (index: number): void => {
    if (!flat[index]) return
    onChange([...skills, flat[index].name])
    close()
  }
  const close = (): void => {
    setOpen(false)
    addRef.current?.focus()
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <ul className={styles.chips} aria-label="Skills">
        {sortSkills(skills).map((name) => (
          <li
            key={name}
            className={[styles.chip, !findSkill(name) && styles.unknown].filter(Boolean).join(' ')}
          >
            <span title={findSkill(name) ? undefined : `${name} is not on the skills list`}>
              {name}
            </span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${name}`}
              onClick={() => removeSkill(name)}
            >
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          </li>
        ))}
        <li>
          <button
            ref={addRef}
            type="button"
            className={styles.add}
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={full}
            title={full ? `Up to ${MAX_SKILLS} skills` : undefined}
            onClick={() => {
              setActive(-1)
              setOpen((o) => !o)
            }}
          >
            <Plus size={12} strokeWidth={2} aria-hidden />
            add
          </button>
        </li>
      </ul>
      {open && (
        <div
          ref={popRef}
          className={styles.popover}
          role="listbox"
          tabIndex={-1}
          aria-label="Add a skill"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onKeyDown={(event) => {
            const last = flat.length - 1
            const move = (to: number): void => {
              event.preventDefault()
              setActive(Math.min(last, Math.max(0, to)))
            }
            if (event.key === 'ArrowDown') move(active + 1)
            else if (event.key === 'ArrowUp') move(active < 0 ? last : active - 1)
            else if (event.key === 'Home') move(0)
            else if (event.key === 'End') move(last)
            else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              pick(active)
            } else if (event.key === 'Tab') {
              // Tab takes the highlighted skill and moves on.
              if (!event.shiftKey && flat[active]) onChange([...skills, flat[active].name])
              setOpen(false)
            } else if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          {SKILL_TAG_ORDER.map((tag) => {
            const options = SKILLS.filter((s) => s.tag === tag && !chosen.has(s.name))
            if (options.length === 0) return null
            return (
              <div key={tag} role="group" aria-label={SKILL_TAG_LABELS[tag]}>
                <p className={styles.group}>{SKILL_TAG_LABELS[tag]}</p>
                <ul className={styles.options}>
                  {options.map((s) => {
                    const index = flat.indexOf(s)
                    return (
                      <li
                        key={s.name}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={false}
                        data-active={index === active}
                        className={styles.option}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(index)}
                      >
                        {s.name}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
