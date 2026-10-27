import { CornerDownRight } from 'lucide-react'
import { useState } from 'react'
import { Picker, type PickerOption } from '@renderer/components/Picker'
import { Select } from '@renderer/components/Select'
import {
  cleanName,
  groupLabel,
  groupOptions,
  isValidName,
  nameKey,
  type GroupSummary
} from '../shared/groups'
import styles from './GroupField.module.css'

interface GroupFieldProps {
  group: string
  subgroup: string
  /** The groups the notes use now. */
  groups: GroupSummary[]
  onChange: (value: { group: string; subgroup: string }) => void
  /** What the field is called ("group" for notes, "list" for tasks); lower case, used in labels. */
  noun?: string
  /** Whether "No group" can be chosen (a task always has a list). */
  allowNone?: boolean
  /**
   * Whether the form can make a new top-level group (default). When not (Work's lists are its clients), the form makes a
   * sublist and must say what it sits inside.
   */
  allowNewTop?: boolean
  /** For a table cell: reads as plain text, the box and arrow appear on hover, focus or while open. */
  plain?: boolean
}

/** A group and its sublist as one string, for a picker's value ('' is no group). */
const keyOf = (group: string, subgroup: string): string =>
  group ? `${group}\u001f${subgroup}` : ''

/**
 * A note's group: the shared picker over the groups that exist (two levels). One field: typing narrows the list, and a
 * name that is not there yet ends it with Create "…" and what it sits inside (nothing, or an existing group), so
 * nobody types a separator.
 */
export function GroupField({
  group,
  subgroup,
  groups,
  onChange,
  noun = 'group',
  allowNone = true,
  allowNewTop = true,
  plain = false
}: GroupFieldProps): React.JSX.Element {
  const [inside, setInside] = useState('')
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  const current = groupLabel(group, subgroup)

  const rows = groupOptions(groups)
  const options: PickerOption[] = [
    ...(allowNone ? [{ value: '', label: `No ${noun}` }] : []),
    ...rows.map((o) => ({
      value: keyOf(o.group, o.subgroup),
      // A sublist shows under its group by its own name; the search still finds it by the whole path.
      label: o.depth === 1 ? o.subgroup : o.group,
      nested: o.depth === 1,
      keywords: o.label
    }))
  ]
  const byKey = new Map(rows.map((o) => [keyOf(o.group, o.subgroup), o]))

  // Without new top-level groups the form's "Inside" starts at this group, else the first there is.
  const target =
    inside ||
    (allowNewTop ? '' : groups.some((g) => g.name === group) ? group : (groups[0]?.name ?? ''))
  const exists = (name: string): boolean =>
    (groups.find((g) => g.name === target)?.subgroups ?? groups).some(
      (g) => nameKey(g.name) === nameKey(name)
    )

  return (
    <Picker
      label={`${Noun}: ${current || 'none'}`}
      noun={`${noun}s`}
      compact
      plain={plain}
      alwaysSearch
      listMinWidth={280}
      value={keyOf(group, subgroup)}
      text={current}
      placeholder={`No ${noun}`}
      options={options}
      onChange={(key) => {
        // Only the two names go on: an option carries more than that.
        const picked = byKey.get(key)
        onChange({ group: picked?.group ?? '', subgroup: picked?.subgroup ?? '' })
      }}
      onOpenChange={(open) => {
        if (!open) setInside('')
      }}
      add={{
        label: (name) => `Create “${cleanName(name)}”`,
        canAdd: (name) =>
          isValidName(name) && !exists(cleanName(name)) && (allowNewTop || target !== ''),
        onAdd: (name) => {
          const typed = cleanName(name)
          onChange(target ? { group: target, subgroup: typed } : { group: typed, subgroup: '' })
        },
        extra: (
          <div className={styles.inside}>
            <CornerDownRight size={14} strokeWidth={1.75} className={styles.mark} aria-hidden />
            <Select
              label="Inside"
              value={target}
              options={[
                ...(allowNewTop ? [{ value: '', label: 'None' }] : []),
                ...groups.map((g) => ({ value: g.name, label: g.name }))
              ]}
              onChange={setInside}
            />
          </div>
        )
      }}
    />
  )
}
