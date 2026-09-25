import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  MAX_SKILLS,
  SKILLS,
  SKILL_TAG_LABELS,
  SKILL_TAG_ORDER,
  findSkill,
  sortSkills
} from '@shared/skills'
import styles from './SkillsField.module.css'

interface SkillsFieldProps {
  skills: string[]
  onChange: (skills: string[]) => void
}

/**
 * The skills of an entry as chips (at most three), with a small menu of the shared skills list to add
 * from. A name in the file that is not on the list is shown outlined and can be removed, never invented.
 */
export function SkillsField({ skills, onChange }: SkillsFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const full = skills.length >= MAX_SKILLS

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const chosen = new Set(skills)
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
              onClick={() => onChange(skills.filter((s) => s !== name))}
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
            onClick={() => setOpen((o) => !o)}
          >
            <Plus size={12} strokeWidth={2} aria-hidden />
            add
          </button>
        </li>
      </ul>
      {open && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label="Add a skill"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
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
                  {options.map((s) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        className={styles.option}
                        onClick={() => {
                          onChange([...skills, s.name])
                          close()
                        }}
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
