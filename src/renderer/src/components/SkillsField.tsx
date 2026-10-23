import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  MAX_SKILLS,
  SKILLS,
  SKILL_TAG_LABELS,
  SKILL_TAG_ORDER,
  findSkill,
  sortSkills
} from '@shared/skills'
import { PickerPopup, type PickerOption } from './Picker'
import styles from './SkillsField.module.css'

interface SkillsFieldProps {
  skills: string[]
  onChange: (skills: string[]) => void
}

/**
 * The skills of an entry as chips (at most three), with the shared picker, under the chip, to add from. A name in the file that is not on the list is shown outlined and can be removed, never invented.
 */
export function SkillsField({ skills, onChange }: SkillsFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const full = skills.length >= MAX_SKILLS

  const chosen = new Set(skills)
  // Each group in turn; what is already chosen is left out. The search also finds a skill by its Inkpath spelling.
  const options: PickerOption[] = SKILL_TAG_ORDER.flatMap((tag) =>
    SKILLS.filter((s) => s.tag === tag && !chosen.has(s.name)).map((s) => ({
      value: s.name,
      label: s.name,
      group: SKILL_TAG_LABELS[tag],
      keywords: s.inkpath
    }))
  )

  return (
    <div className={styles.wrap}>
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
            aria-haspopup="listbox"
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
      {open && !full && (
        <PickerPopup
          anchorRef={addRef}
          minWidth={280}
          options={options}
          label="Add a skill"
          noun="skills"
          onPick={(name) => onChange([...skills, name])}
          onClose={(reason) => {
            setOpen(false)
            if (reason !== 'outside') addRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
