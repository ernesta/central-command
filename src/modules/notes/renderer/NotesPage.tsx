import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { FilterRow } from '@renderer/components/FilterRow'
import { SearchInput } from '@renderer/components/SearchInput'
import { Select } from '@renderer/components/Select'
import {
  ALL_GROUPS,
  deriveGroups,
  filterTitle,
  groupOptions,
  type GroupFilter
} from '../shared/groups'
import { DEFAULT_NOTES_QUERY, queryNotes, reconcileQuery, type NotesQuery } from '../shared/query'
import { NewNoteButton } from './NewNoteButton'
import { notesBase } from './notes-paths'
import { NotesTable } from './NotesTable'
import { useNotesList } from './useNotesList'
import { useNotesView } from './useNotesView'
import styles from './NotesPage.module.css'

/** A group filter as the text a selector holds (a group's name may be anything, so it is not used as it is). */
function filterValue(filter: GroupFilter): string {
  if (filter.scope !== 'group') return filter.scope
  return `group:${filter.group}\u0000${filter.subgroup}`
}

function valueFilter(value: string): GroupFilter {
  if (value === 'ungrouped') return { scope: 'ungrouped' }
  if (!value.startsWith('group:')) return ALL_GROUPS
  const [group, subgroup] = value.slice('group:'.length).split('\u0000')
  return { scope: 'group', group, subgroup: subgroup ?? '' }
}

/** All notes: search, a group selector and the list. The page is titled with the group when one is chosen. */
export function NotesPage(): React.JSX.Element {
  const rows = useNotesList()
  // A group card on the landing page opens the list already filtered to that group (for this visit only, with the
  // search cleared so the group is what you see).
  const [params] = useSearchParams()
  const groupParam = params.get('group')
  const opened: Partial<NotesQuery> | undefined = groupParam
    ? {
        search: '',
        group: {
          scope: 'group',
          group: groupParam,
          subgroup: params.get('subgroup') ?? ''
        }
      }
    : params.get('ungrouped')
      ? { search: '', group: { scope: 'ungrouped' } }
      : undefined
  const { query: saved, setQuery } = useNotesView(opened)

  const everything = useMemo(() => rows ?? [], [rows])
  const groups = useMemo(() => deriveGroups(everything), [everything])
  // A remembered group that no longer exists must not hide everything.
  const query = rows === null ? saved : reconcileQuery(saved, groups)
  const visible = queryNotes(everything, query)
  const title = filterTitle(query.group)
  const filtered = query.search.trim() !== '' || query.group.scope !== 'all'

  let content: React.ReactNode = null
  if (rows === null) content = null
  else if (everything.length === 0) {
    content = <EmptyState heading="No notes yet" message="Create a note to start." />
  } else if (visible.length === 0) {
    content = (
      <EmptyState heading="No matching notes" message="Try a different search or group.">
        {filtered && <Button onClick={() => setQuery(DEFAULT_NOTES_QUERY)}>Clear filters</Button>}
      </EmptyState>
    )
  } else content = <NotesTable rows={visible} />

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={notesBase}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Notes
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>{title ?? 'All notes'}</h1>
        <div className={styles.actions}>
          <NewNoteButton
            group={query.group.scope === 'group' ? query.group.group : ''}
            subgroup={query.group.scope === 'group' ? query.group.subgroup : ''}
          />
        </div>
      </header>

      <FilterRow>
        <SearchInput
          label="Search notes"
          value={query.search}
          onChange={(search) => setQuery({ search })}
        />
        <Select
          label="Filter by group"
          value={filterValue(query.group)}
          options={[
            { value: 'all', label: 'All groups' },
            { value: 'ungrouped', label: 'Ungrouped' },
            ...groupOptions(groups).map((o) => ({
              value: filterValue({ scope: 'group', group: o.group, subgroup: o.subgroup }),
              label: o.label
            }))
          ]}
          onChange={(value) => setQuery({ group: valueFilter(value) })}
        />
      </FilterRow>

      <div className={styles.content}>{content}</div>

      {rows !== null && visible.length > 0 && (
        <p className={styles.hint}>Most recently edited first. Click any row to open the note.</p>
      )}
    </div>
  )
}
