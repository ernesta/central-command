import { deriveGroups } from '@modules/notes/shared/groups'
import { GroupField } from '@modules/notes/renderer/GroupField'
import type { TaskRow } from '../shared/views'

/** A task's list: pick one in use (a list, or a list and its sublist) or make a new one. A task always has a list. */
export function ListField({
  list,
  sublist,
  rows,
  onChange
}: {
  list: string
  sublist: string
  rows: readonly TaskRow[]
  onChange: (value: { list: string; sublist: string }) => void
}): React.JSX.Element {
  // The groups the notes use are derived the same way: a "group" here is a list, a "subgroup" a sublist.
  const groups = deriveGroups(rows.map((r) => ({ group: r.task.list, subgroup: r.task.sublist })))
  return (
    <GroupField
      noun="list"
      allowNone={false}
      group={list}
      subgroup={sublist}
      groups={groups}
      onChange={(g) => onChange({ list: g.group, sublist: g.subgroup })}
    />
  )
}
