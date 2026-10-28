import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { FilterRow } from '@renderer/components/FilterRow'
import { SearchInput } from '@renderer/components/SearchInput'
import { Select } from '@renderer/components/Select'
import { useModuleState } from '@renderer/state/use-module-state'
import {
  DEFAULT_WATCH_QUERY,
  groupItems,
  LIST_STATES,
  LIST_STATE_LABELS,
  normaliseWatchQuery,
  queryItems,
  reconcileWatchQuery,
  sourceOptions,
  watchFiltersActive
} from '../shared/query'
import { KIND_NOUN } from '../shared/rows'
import type { ShownKind } from '../shared/types'
import { todayIso, useWatchWorkspace } from './watch-paths'
import { useWatchItems } from './useWatchItems'
import { WatchTable } from './WatchTable'
import styles from './WatchAllPage.module.css'

/** Every item of one kind (See all trainings, See all conferences): search, source and state filters, "New" above "Earlier". */
export function WatchAllPage({ kind }: { kind: ShownKind }): React.JSX.Element {
  const noun = KIND_NOUN[kind].many.toLowerCase()
  const workspace = useWatchWorkspace()
  const { items, ...actions } = useWatchItems({ kind, limit: 1000 })
  // Each workspace's kind remembers its own search and filters (Research's keep the key they had).
  const { value: saved, update: setQuery } = useModuleState(
    workspace === 'research' ? `watch-${kind}` : `watch-${workspace}-${kind}`,
    normaliseWatchQuery
  )
  const all = items ?? []
  const query = items === null ? saved : reconcileWatchQuery(saved, all)
  const visible = queryItems(all, query)
  const today = todayIso()

  let content: React.ReactNode = null
  if (items === null) content = null
  else if (all.length === 0)
    content = (
      <EmptyState
        heading={`No ${noun} yet`}
        message="They show here once a source has found some."
      />
    )
  else if (visible.length === 0)
    content = (
      <EmptyState heading="Nothing matches" message="Try a different search or filter.">
        {watchFiltersActive(query) && (
          <Button onClick={() => setQuery(DEFAULT_WATCH_QUERY)}>Clear filters</Button>
        )}
      </EmptyState>
    )
  else
    content = (
      <WatchTable
        groups={groupItems(visible, query)}
        today={today}
        label={KIND_NOUN[kind].many}
        actions={actions}
      />
    )

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>All {noun}</h1>
      <FilterRow>
        <SearchInput
          label={`Search ${noun}`}
          value={query.search}
          onChange={(search) => setQuery({ search })}
        />
        <Select
          label="Filter by source"
          search
          noun="sources"
          value={query.source}
          options={[
            { value: 'all', label: 'All sources' },
            ...sourceOptions(all).map((s) => ({ value: String(s.id), label: s.title }))
          ]}
          onChange={(source) => setQuery({ source })}
        />
        <Select
          label="Filter by state"
          value={query.state}
          options={LIST_STATES.map((s) => ({ value: s, label: LIST_STATE_LABELS[s] }))}
          onChange={(state) => setQuery({ state })}
        />
      </FilterRow>
      <div className={styles.content}>{content}</div>
    </div>
  )
}
