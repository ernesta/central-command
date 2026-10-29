import { useToday } from '@renderer/state/use-today'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { FilterRow } from '@renderer/components/FilterRow'
import { SearchInput } from '@renderer/components/SearchInput'
import { Select } from '@renderer/components/Select'
import { useState } from 'react'
import {
  DEFAULT_WATCH_QUERY,
  groupItems,
  LIST_STATES,
  LIST_STATE_LABELS,
  queryItems,
  reconcileWatchQuery,
  sourceOptions,
  watchFiltersActive,
  type WatchQuery
} from '../shared/query'
import { SECTION_NOUN } from '../shared/rows'
import type { WatchSection } from '../shared/types'
import { useManualEntries } from './useManualEntries'
import { useWatchItems } from './useWatchItems'
import { WatchTable } from './WatchTable'
import styles from './WatchAllPage.module.css'

/** Every item of one section (See all trainings, conferences, events, opportunities): search, source and state filters, grouped Saved, New, Read. */
export function WatchAllPage({ section }: { section: WatchSection }): React.JSX.Element {
  const noun = SECTION_NOUN[section].many.toLowerCase()
  const { items, ...itemActions } = useWatchItems({ section, limit: 1000 })
  const entries = useManualEntries()
  const actions = { ...itemActions, ...entries.actions }
  // The filters are not remembered: every visit starts on All sources, All.
  const [saved, setSaved] = useState<WatchQuery>(DEFAULT_WATCH_QUERY)
  const setQuery = (changes: Partial<WatchQuery>): void => setSaved((q) => ({ ...q, ...changes }))
  const all = items ?? []
  const query = items === null ? saved : reconcileWatchQuery(saved, all)
  const visible = queryItems(all, query)
  const today = useToday()

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
        label={SECTION_NOUN[section].many}
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
      {entries.dialog}
    </div>
  )
}
