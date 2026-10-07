import { deriveGroups } from '@modules/notes/shared/groups'
import { GroupField } from '@modules/notes/renderer/GroupField'
import { offeredLists } from '../shared/work-lists'
import type { TaskWorkspace } from '../shared/types'
import type { TaskRow } from '../shared/views'
import { useWorkClients } from './useWorkClients'

/**
 * A task's list: pick one in use (a list, or a list and its sublist) or make a new one. A task always has a list. In Work the
 * lists are the clients, empty ones included, and a new name can only be a sublist.
 */
export function ListField({
  workspace,
  list,
  sublist,
  rows,
  onChange
}: {
  workspace: TaskWorkspace
  list: string
  sublist: string
  rows: readonly TaskRow[]
  onChange: (value: { list: string; sublist: string }) => void
}): React.JSX.Element {
  const clients = useWorkClients(workspace)
  // The groups the notes use are derived the same way: a "group" here is a list, a "subgroup" a sublist.
  const groups = deriveGroups(
    offeredLists(
      rows.map((r) => ({ list: r.task.list, sublist: r.task.sublist })),
      clients
    ).map((l) => ({ group: l.list, subgroup: l.sublist }))
  )
  return (
    <GroupField
      noun="list"
      allowNone={false}
      allowNewTop={clients === null}
      group={list}
      subgroup={sublist}
      groups={groups}
      onChange={(g) => onChange({ list: g.group, sublist: g.subgroup })}
    />
  )
}
